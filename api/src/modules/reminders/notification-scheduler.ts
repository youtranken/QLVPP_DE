import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ClockService } from '../../common/clock.service';
import { addMonths } from '../../common/period';
import { pgSqlState } from '../../common/sql';
import { DRIZZLE_DB } from '../../database/database.module';
import type { Database } from '../../database/database.module';
import { StockService } from '../catalog/stock.service';
import { SystemConfigService } from '../config/system-config.service';
import { eventIds } from '../notifications/notification-events';
import { NotificationsService } from '../notifications/notifications.service';
import type { NotifyInput } from '../notifications/notifications.service';
import { PeriodsService } from '../periods/periods.service';
import type { Period } from '../periods/periods.service';
import { SummaryService } from '../requests/summary.service';
import { AdmOutSettlement } from './adm-out-settlement';
import { isLockDay, isPeriodOpenDay, isReminderDay } from './schedule-days';

export interface HourlyResult {
  period_open: number;
  reminder: number;
  period_locked: number;
  low_stock: number;
  purged: number;
}

const RETENTION_MS = 90 * 86_400_000;

// e2e gọi runHourly với mốc cố định; cron/boot chạy theo đồng hồ thật sẽ chen dữ liệu vào suite khác
const scheduleEnabled = () => process.env.NODE_ENV !== 'test';

// Mỗi bước tự idempotent (event_id, headcount IS NULL, low_stock_notified_at) nên chạy lại/khởi động lại không gửi trùng
@Injectable()
export class NotificationScheduler
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(NotificationScheduler.name);
  private running: Promise<unknown> | null = null;

  constructor(
    @Inject(DRIZZLE_DB) private readonly db: Database,
    private readonly clock: ClockService,
    private readonly periods: PeriodsService,
    private readonly summary: SummaryService,
    private readonly notifications: NotificationsService,
    private readonly stock: StockService,
    private readonly config: SystemConfigService,
    private readonly settlement: AdmOutSettlement,
  ) {}

  onApplicationBootstrap(): void {
    if (scheduleEnabled()) void this.tick();
  }

  async onModuleDestroy(): Promise<void> {
    await this.running;
  }

  @Cron('5 * * * *', {
    name: 'notifications-hourly',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async tick(): Promise<void> {
    if (!scheduleEnabled() || this.running) return;
    this.running = this.runHourly(this.clock.now()).finally(() => {
      this.running = null;
    });
    await this.running;
  }

  async runHourly(now: Date): Promise<HourlyResult> {
    const open = await this.step('open_period', null, () =>
      this.periods.openPeriod(this.db, now),
    );
    return {
      period_open: open
        ? await this.step('period_open', 0, () => this.announce(open, now))
        : 0,
      reminder: open
        ? await this.step('reminder', 0, () => this.remind(open, now))
        : 0,
      period_locked: await this.step('locked', 0, () => this.locked(now)),
      low_stock: await this.step('low_stock', 0, () => this.lowStock(now)),
      purged: await this.step('purge', 0, () =>
        this.notifications.purgeBefore(new Date(now.getTime() - RETENTION_MS)),
      ),
    };
  }

  private async announce(open: Period, now: Date): Promise<number> {
    if (!isPeriodOpenDay(now)) return 0;
    return this.notify({
      eventId: eventIds.periodOpen(open.ym),
      recipients: await this.summary.audienceSubs(),
      topic: 'period_open',
      params: { ym: open.ym, deadline: open.deadline.toISOString() },
      link: '/',
      now,
    });
  }

  private async remind(open: Period, now: Date): Promise<number> {
    const daysLeft = await this.config.getInt('reminder_days_left');
    if (!isReminderDay(now, open.deadline, daysLeft)) return 0;
    return this.notify({
      eventId: eventIds.reminder(open.ym),
      recipients: await this.summary.unregisteredSubs(open.ym),
      topic: 'reminder',
      params: { ym: open.ym, deadline: open.deadline.toISOString() },
      link: '/',
      now,
    });
  }

  // Tập người S ghi bù kể cả khi trượt ngày khóa; chuông chỉ gửi đúng ngày khóa, kỳ 0 phiếu vẫn gửi (0/N)
  private async locked(now: Date): Promise<number> {
    const period = await this.periods.latestLocked(now);
    if (!period) return 0;
    if (period.headcount === null) {
      const subs = await this.summary.liveSubs(period.ym);
      await this.db.transaction(async (tx) => {
        await this.periods.recordHeadcount(period.ym, subs, tx);
        await this.settlement.settleAdmOut(tx, addMonths(period.ym, -1), now);
      });
    }
    if (!isLockDay(now, period.deadline)) return 0;
    const { registered, headcount } = await this.summary.people(period.ym);
    const { custom_pending } = await this.summary.lineCounts(period.ym);
    return this.notify({
      eventId: eventIds.periodLocked(period.ym),
      recipients: await this.notifications.adminRecipients(),
      topic: 'period_locked',
      params: { ym: period.ym, registered, headcount, custom_pending },
      link:
        custom_pending > 0
          ? `/admin/review?ym=${period.ym}`
          : `/admin/summary?ym=${period.ym}`,
      now,
    });
  }

  // Tắt cờ hoặc chưa có admin thì không đòi quyền: món giữ chưa đánh dấu để được báo khi bật lại/có admin
  private async lowStock(now: Date): Promise<number> {
    if (!(await this.config.getBool('low_stock_notify'))) return 0;
    const recipients = await this.notifications.adminRecipients();
    if (recipients.length === 0) return 0;
    return this.db.transaction(async (tx) => {
      const items = await this.stock.claimLowStockWithin(tx, now);
      let sent = 0;
      for (const item of items) {
        sent += await this.notifications.notifyWithin(tx, {
          eventId: eventIds.lowStock(item.id, item.last_purchase_id),
          recipients,
          topic: 'low_stock',
          params: {
            name: item.name,
            name_en: item.name_en,
            stock_qty: item.stock_qty,
          },
          // Tủ / Kho xếp món theo phần trống (thiếu/chờ hàng/sắp hết), không theo tồn → mở thẳng món
          link: `/admin/stock?${new URLSearchParams({ q: item.name })}`,
          now,
        });
      }
      return sent;
    });
  }

  private notify(input: NotifyInput): Promise<number> {
    return this.db.transaction((tx) =>
      this.notifications.notifyWithin(tx, input),
    );
  }

  private async step<T>(
    name: string,
    fallback: T,
    fn: () => Promise<T>,
  ): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      // message của DrizzleQueryError chứa cả SQL và params: chỉ log mã
      this.logger.error({
        msg: 'notification_cron_step_failed',
        step: name,
        code: pgSqlState(error) ?? (error as Error).name,
      });
      return fallback;
    }
  }
}
