import { Inject, Injectable } from '@nestjs/common';
import { ClockService } from '../../common/clock.service';
import { DRIZZLE_DB } from '../../database/database.module';
import type { Database } from '../../database/database.module';
import type { RequestIdentity } from '../auth/identity.types';
import { PeriodsService } from '../periods/periods.service';
import { invalidPeriod, requestNotFound } from './request-errors';
import { RequestLinesWriter } from './request-lines.writer';
import { RequestViewBuilder } from './request-view';
import type { RequestView } from './request-view';
import type { SaveMyLinesBody } from './request.dto';
import * as repo from './requests.repo';

@Injectable()
export class MeRequestService {
  constructor(
    @Inject(DRIZZLE_DB) private readonly db: Database,
    private readonly clock: ClockService,
    private readonly periods: PeriodsService,
    private readonly writer: RequestLinesWriter,
    private readonly views: RequestViewBuilder,
  ) {}

  async get(me: RequestIdentity, ym?: string): Promise<RequestView> {
    const open = await this.periods.openPeriod(this.db, this.clock.now());
    const target = ym ?? open.ym;
    // 'YYYY-MM' so sánh chuỗi đúng thứ tự thời gian
    if (target > open.ym) throw invalidPeriod();
    const found = await repo.findRequest(this.db, {
      ym: target,
      user_sub: me.sub,
    });
    const view =
      found && (await this.views.build(this.db, found.id, target === open.ym));
    if (!view) throw requestNotFound();
    return view;
  }

  async saveLines(
    me: RequestIdentity,
    body: SaveMyLinesBody,
  ): Promise<{ request: RequestView | null }> {
    const now = this.clock.now();
    return this.db.transaction(async (tx) => {
      const { request_id } = await this.writer.save(tx, {
        owner_sub: me.sub,
        period_ym: body.ym,
        actor: me,
        body,
        now,
      });
      // Writer đã chặn kỳ khác kỳ đang mở → phiếu vừa ghi luôn thuộc kỳ mở
      return {
        request: request_id
          ? await this.views.build(tx, request_id, true)
          : null,
      };
    });
  }
}
