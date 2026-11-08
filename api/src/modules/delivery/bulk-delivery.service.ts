import {
  BadRequestException,
  HttpException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { ClockService } from '../../common/clock.service';
import { DRIZZLE_DB } from '../../database/database.module';
import type { Database, Tx } from '../../database/database.module';
import { PeriodsService } from '../periods/periods.service';
import { LineDeliveryStore } from '../requests/line-delivery.store';
import type { LockedLine } from '../requests/line-delivery.store';
import { lineNotFound } from '../requests/request-errors';
import type {
  BulkDeliverBody,
  BulkDeliverResult,
  BulkLine,
  BulkRequest,
  BulkRequestResult,
} from './bulk-delivery.dto';
import { assertDeliverable, DeliveryService } from './delivery.service';
import { staleDelivery } from './delivery-errors';

const KNOWN_FIELDS = ['available', 'remaining'] as const;

// Lỗi nghiệp vụ có `code` của một phiếu; line_id gắn khi lỗi thuộc một dòng cụ thể
class RequestFailure extends Error {
  constructor(
    readonly error: HttpException,
    readonly lineId?: string,
  ) {
    super('bulk request failed');
  }
}

@Injectable()
export class BulkDeliveryService {
  constructor(
    @Inject(DRIZZLE_DB) private readonly db: Database,
    private readonly clock: ClockService,
    private readonly periods: PeriodsService,
    private readonly lines: LineDeliveryStore,
    private readonly delivery: DeliveryService,
  ) {}

  // Mỗi phiếu một transaction: một phiếu lỗi không kéo phiếu khác, kết quả trả theo thứ tự body
  async deliver(
    body: BulkDeliverBody,
    actor: string,
  ): Promise<BulkDeliverResult> {
    assertDistinct(body.requests);
    const results: BulkRequestResult[] = [];
    for (const req of body.requests) {
      results.push(await this.deliverRequest(req, actor));
    }
    return { results };
  }

  private async deliverRequest(
    req: BulkRequest,
    actor: string,
  ): Promise<BulkRequestResult> {
    const now = this.clock.now();
    try {
      const done = await this.db.transaction((tx) =>
        this.deliverOne(tx, req, actor, now),
      );
      return { request_id: req.request_id, ok: true, ...done };
    } catch (e) {
      if (e instanceof RequestFailure) return failed(req.request_id, e);
      throw e;
    }
  }

  private async deliverOne(
    tx: Tx,
    req: BulkRequest,
    actor: string,
    now: Date,
  ): Promise<{ delivered_units: number; request_complete: boolean }> {
    const ids = req.lines.map((l) => l.line_id);
    const locked = await this.lines.lockRequestLines(tx, req.request_id, ids);
    const byId = new Map(locked.map((l) => [l.id, l]));
    const missing = ids.find((id) => !byId.has(id));
    if (missing) throw new RequestFailure(lineNotFound(), missing);
    await this.guard(() =>
      this.periods.assertLocked(locked[0].period_ym, now, tx),
    );
    const todo = orderForLocking(req.lines, byId);
    for (const { line, want } of todo) {
      await this.guard(() => {
        assertDeliverable(line);
        if (line.delivered_qty !== want.expected_delivered_qty) {
          throw staleDelivery(line.delivered_qty);
        }
      }, line.id);
    }
    let units = 0;
    for (const { line, want } of todo) {
      await this.guard(
        () => this.delivery.deliverWithin(tx, line, want.qty, actor, now),
        line.id,
      );
      units += want.qty;
    }
    await this.lines.touchRequest(tx, req.request_id, now);
    const complete = await this.delivery.notifyIfComplete(tx, locked[0], now);
    return { delivered_units: units, request_complete: complete };
  }

  // Chỉ lỗi HTTP có `code` là kết quả của phiếu; lỗi lạ ném tiếp (500) để không nuốt
  private async guard<T>(
    fn: () => T | Promise<T>,
    lineId?: string,
  ): Promise<T> {
    try {
      return await fn();
    } catch (e) {
      if (e instanceof HttpException && codeOf(e)) {
        throw new RequestFailure(e, lineId);
      }
      throw e;
    }
  }
}

function codeOf(e: HttpException): string | undefined {
  const r = e.getResponse();
  return typeof r === 'object' ? (r as { code?: string }).code : undefined;
}

function failed(requestId: string, f: RequestFailure): BulkRequestResult {
  const r = f.error.getResponse() as Record<string, unknown>;
  const out: BulkRequestResult = {
    request_id: requestId,
    ok: false,
    code: r.code as string,
  };
  const lineId = f.lineId ?? (r.line_id as string | undefined);
  if (lineId) out.line_id = lineId;
  for (const k of KNOWN_FIELDS) {
    if (typeof r[k] === 'number') out[k] = r[k];
  }
  return out;
}

// Thứ tự khóa món: item_id (null cuối) rồi line_id — cùng chiều với giao đơn
function orderForLocking(
  wanted: BulkLine[],
  byId: Map<string, LockedLine>,
): { line: LockedLine; want: BulkLine }[] {
  return wanted
    .map((want) => ({ line: byId.get(want.line_id)!, want }))
    .sort((a, b) => {
      const ai = a.line.item_id;
      const bi = b.line.item_id;
      if (ai !== bi) {
        if (ai === null) return 1;
        if (bi === null) return -1;
        return ai < bi ? -1 : 1;
      }
      return a.line.id < b.line.id ? -1 : a.line.id > b.line.id ? 1 : 0;
    });
}

function assertDistinct(requests: BulkRequest[]): void {
  const ids = new Set<string>();
  for (const r of requests) {
    const lineIds = new Set(r.lines.map((l) => l.line_id));
    if (ids.has(r.request_id) || lineIds.size !== r.lines.length) {
      throw new BadRequestException({
        code: 'VALIDATION',
        message: 'Phiếu hoặc dòng bị lặp trong yêu cầu.',
        fields: ['requests'],
      });
    }
    ids.add(r.request_id);
  }
}
