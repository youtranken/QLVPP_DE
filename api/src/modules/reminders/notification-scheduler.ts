import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ClockService } from '../../common/clock.service';
import { DRIZZLE_DB } from '../../database/database.module';
import type { Database } from '../../database/database.module';
import { StockService } from '../catalog/stock.service';
import { eventIds } from '../notifications/notification-events';
import { NotificationsService } from '../notifications/notifications.service';
import type { NotifyInput } from '../notifications/notifications.service';
import { PeriodsService } from '../periods/periods.service';
import { SummaryService } from '../requests/summary.service';
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
    const [period_open, reminder] = await this.step('open', [0, 0], () =>
      this.openAndRemind(now),
    );
    return {
      period_open,
      reminder,
      period_locked: await this.step('locked', 0, () => this.locked(now)),
      low_stock: await this.step('low_stock', 0, () => this.lowStock(now)),
      purged: await this.step('purge', 0, () =>
        this.notifications.purgeBefore(new Date(now.getTime() - RETENTION_MS)),
      ),
    };
  }

  private async openAndRemind(now: Date): Promise<[number, number]> {
    const open = await this.periods.openPeriod(this.db, now);
    const params = { ym: open.ym, deadline: open.deadline.toISOString() };
    const opened = isPeriodOpenDay(now)
      ? await this.notify({
          eventId: eventIds.periodOpen(open.ym),
          recipients: await this.summary.audienceSubs(),
          topic: 'period_open',
          params,
          link: '/',
          now,
        })
      : 0;
    const reminded = isReminderDay(now, open.deadline)
      ? await this.notify({
          eventId: eventIds.reminder(open.ym),
          recipients: await this.summary.unregisteredSubs(open.ym),
          topic: 'reminder',
          params,
          link: '/',
          now,
        })
      : 0;
    return [opened, reminded];
  }

  // Headcount ghi bù kể cả khi trượt ngày khóa; chuông chỉ gửi đúng ngày khóa (giả định 3, review-spec F)
  private async locked(now: Date): Promise<number> {
    const period = await this.periods.latestLocked(now);
    if (!period) return 0;
    let headcount = period.headcount;
    if (headcount === null) {
      headcount = (await this.summary.liveCounts(period.ym)).headcount;
      await this.periods.recordHeadcount(period.ym, headcount);
    }
    if (!isLockDay(now, period.deadline)) return 0;
    const { registered } = await this.summary.requestCounts(period.ym);
    return this.notify({
      eventId: eventIds.periodLocked(period.ym),
      recipients: await this.notifications.adminRecipients(),
      topic: 'period_locked',
      params: { ym: period.ym, registered, headcount },
      link: `/admin/summary?ym=${period.ym}`,
      now,
    });
  }

  private lowStock(now: Date): Promise<number> {
    return this.db.transaction(async (tx) => {
      const items = await this.stock.claimLowStockWithin(tx, now);
      if (items.length === 0) return 0;
      const recipients = await this.notifications.adminRecipients(tx);
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
          link: '/admin/stock?filter=low',
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
      this.logger.error({
        msg: 'notification_cron_step_failed',
        step: name,
        error: (error as Error).message,
      });
      return fallback;
    }
  }
}
