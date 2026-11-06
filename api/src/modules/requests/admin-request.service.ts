import { Inject, Injectable } from '@nestjs/common';
import { ClockService } from '../../common/clock.service';
import { DRIZZLE_DB } from '../../database/database.module';
import type { Database } from '../../database/database.module';
import type { RequestIdentity } from '../auth/identity.types';
import { requestNotFound } from './request-errors';
import { RequestLinesWriter } from './request-lines.writer';
import { RequestViewBuilder } from './request-view';
import type { RequestView } from './request-view';
import type { SaveLinesBody } from './request.dto';
import * as repo from './requests.repo';

@Injectable()
export class AdminRequestService {
  constructor(
    @Inject(DRIZZLE_DB) private readonly db: Database,
    private readonly clock: ClockService,
    private readonly writer: RequestLinesWriter,
    private readonly views: RequestViewBuilder,
  ) {}

  async saveLines(
    admin: RequestIdentity,
    id: string,
    body: SaveLinesBody,
  ): Promise<{ request: RequestView | null }> {
    const now = this.clock.now();
    return this.db.transaction(async (tx) => {
      // Khóa phiếu trước: writer xét kỳ khóa sổ trên đúng hàng đã khóa
      const found = await repo.findRequest(tx, { id }, true);
      if (!found) throw requestNotFound('Không tìm thấy phiếu.');
      const { request_id } = await this.writer.save(tx, {
        request: found,
        owner_sub: found.user_sub,
        period_ym: found.period_ym,
        actor: admin,
        mode: 'admin',
        body,
        now,
      });
      if (!request_id) return { request: null };
      return { request: await this.views.build(tx, request_id, false) };
    });
  }
}
