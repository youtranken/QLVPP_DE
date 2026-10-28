import { HttpException, Inject, Injectable } from '@nestjs/common';
import { ClockService } from '../../common/clock.service';
import { DRIZZLE_DB } from '../../database/database.module';
import type { Database } from '../../database/database.module';
import type { RequestIdentity } from '../auth/identity.types';
import { LOCAL_SA_SUB } from '../auth/local-sa-env';
import { PeriodsService } from '../periods/periods.service';
import { UsersService } from '../users/users.service';
import {
  linesEmpty,
  requestExists,
  requestNotFound,
  userInactive,
  userNotFound,
} from './request-errors';
import { RequestLinesWriter } from './request-lines.writer';
import { RequestViewBuilder } from './request-view';
import type { RequestView } from './request-view';
import type { CreateOnBehalfBody, SaveLinesBody } from './request.dto';
import * as repo from './requests.repo';

@Injectable()
export class AdminRequestService {
  constructor(
    @Inject(DRIZZLE_DB) private readonly db: Database,
    private readonly clock: ClockService,
    private readonly periods: PeriodsService,
    private readonly users: UsersService,
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
      const found = await repo.findRequest(tx, { id });
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
      const open = await this.periods.openPeriod(tx, now);
      return {
        request: await this.views.build(
          tx,
          request_id,
          found.period_ym === open.ym,
        ),
      };
    });
  }

  // Luôn tạo vào kỳ đang mở (FR-32, BR-7): sau hạn kỳ cũ thì là kỳ kế
  async create(
    admin: RequestIdentity,
    body: CreateOnBehalfBody,
  ): Promise<{ request: RequestView | null }> {
    if (body.lines.length === 0) throw linesEmpty();
    // SA cục bộ có dòng users active nhưng không thuộc danh bạ → không có phiếu
    if (body.user_sub === LOCAL_SA_SUB) throw userNotFound();
    const owner = await this.users.findBySub(body.user_sub);
    if (!owner) throw userNotFound();
    if (owner.status !== 'active') throw userInactive();
    try {
      return await this.insertOnBehalf(admin, body);
    } catch (error) {
      // Đua với lần tạo/lưu khác: writer thấy phiếu đã có mà không có expected_updated_at
      if (isStale(error)) throw requestExists();
      throw error;
    }
  }

  private insertOnBehalf(
    admin: RequestIdentity,
    body: CreateOnBehalfBody,
  ): Promise<{ request: RequestView | null }> {
    const now = this.clock.now();
    return this.db.transaction(async (tx) => {
      const open = await this.periods.openPeriod(tx, now);
      const existing = await repo.findRequest(tx, {
        ym: open.ym,
        user_sub: body.user_sub,
      });
      if (existing) throw requestExists();
      const { request_id } = await this.writer.save(tx, {
        request: null,
        owner_sub: body.user_sub,
        period_ym: open.ym,
        actor: admin,
        mode: 'admin',
        on_behalf: true,
        body: { lines: body.lines },
        now,
      });
      return {
        request: request_id
          ? await this.views.build(tx, request_id, true)
          : null,
      };
    });
  }
}

function isStale(error: unknown): boolean {
  return (
    error instanceof HttpException &&
    (error.getResponse() as { code?: string }).code === 'STALE_UPDATE'
  );
}
