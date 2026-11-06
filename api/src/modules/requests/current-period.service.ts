import { Inject, Injectable } from '@nestjs/common';
import { ClockService } from '../../common/clock.service';
import { addMonths, daysLeft } from '../../common/period';
import { DRIZZLE_DB } from '../../database/database.module';
import type { Database } from '../../database/database.module';
import { PeriodsService } from '../periods/periods.service';
import { owedPeriods } from './owed.repo';
import type { OwedPeriod } from './owed.repo';
import * as repo from './requests.repo';

export interface CurrentPeriod {
  ym: string;
  deadline: string;
  is_open: true;
  days_left: number;
  previous: { ym: string; delivering: boolean } | null;
  owed: OwedPeriod[];
}

// Kỳ đang mở + phần còn chờ nhận của người gọi: ghép ở requests để periods không đọc bảng phiếu
@Injectable()
export class CurrentPeriodService {
  constructor(
    @Inject(DRIZZLE_DB) private readonly db: Database,
    private readonly clock: ClockService,
    private readonly periods: PeriodsService,
  ) {}

  async get(userSub: string, role: string): Promise<CurrentPeriod> {
    const now = this.clock.now();
    const period = await this.periods.openPeriod(this.db, now);
    const member = role === 'member';
    return {
      ym: period.ym,
      deadline: period.deadline.toISOString(),
      is_open: true,
      days_left: daysLeft(now, period.deadline),
      previous: member ? await this.previous(period.ym, userSub) : null,
      owed: member ? await owedPeriods(this.db, userSub, period.ym) : [],
    };
  }

  private async previous(
    ym: string,
    userSub: string,
  ): Promise<CurrentPeriod['previous']> {
    const prevYm = addMonths(ym, -1);
    const delivering = await repo.hasUndeliveredLines(this.db, prevYm, userSub);
    return delivering === null ? null : { ym: prevYm, delivering };
  }
}
