import { Inject, Injectable } from '@nestjs/common';
import { ClockService } from '../../common/clock.service';
import { addMonths, daysLeft } from '../../common/period';
import { DRIZZLE_DB } from '../../database/database.module';
import type { Database } from '../../database/database.module';
import { PeriodsService } from '../periods/periods.service';
import * as repo from './requests.repo';

export interface CurrentPeriod {
  ym: string;
  deadline: string;
  is_open: true;
  days_left: number;
  previous: { ym: string; delivering: boolean } | null;
}

// Kỳ đang mở + phiếu kỳ trước của người gọi còn nợ giao không: ghép ở requests để periods không đọc bảng phiếu
@Injectable()
export class CurrentPeriodService {
  constructor(
    @Inject(DRIZZLE_DB) private readonly db: Database,
    private readonly clock: ClockService,
    private readonly periods: PeriodsService,
  ) {}

  async current(userSub: string): Promise<CurrentPeriod> {
    const now = this.clock.now();
    const period = await this.periods.openPeriod(this.db, now);
    const prevYm = addMonths(period.ym, -1);
    const delivering = await repo.hasUndeliveredLines(this.db, prevYm, userSub);
    return {
      ym: period.ym,
      deadline: period.deadline.toISOString(),
      is_open: true,
      days_left: daysLeft(now, period.deadline),
      previous: delivering === null ? null : { ym: prevYm, delivering },
    };
  }
}
