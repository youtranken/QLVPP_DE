import { HttpException, Inject, Injectable } from '@nestjs/common';
import { ClockService } from '../../common/clock.service';
import { DRIZZLE_DB } from '../../database/database.module';
import type { Database, Tx } from '../../database/database.module';
import { StockService } from '../catalog/stock.service';
import { LineDeliveryStore } from '../requests/line-delivery.store';
import type { LockedLine } from '../requests/line-delivery.store';
import { requestNotFound } from '../requests/request-errors';
import type { DeliverAllFailure, DeliverAllResult } from './delivery.dto';
import { DeliveryService, remainingOf } from './delivery.service';

// Lỗi của riêng một dòng: ghi vào failed[], các dòng khác vẫn giao; lỗi khác hủy cả phiếu
const LINE_FAILURES = new Set([
  'LINE_NOT_REVIEWED',
  'LINE_REJECTED',
  'STOCK_INSUFFICIENT',
]);

@Injectable()
export class DeliverAllService {
  constructor(
    @Inject(DRIZZLE_DB) private readonly db: Database,
    private readonly clock: ClockService,
    private readonly lines: LineDeliveryStore,
    private readonly stock: StockService,
    private readonly delivery: DeliveryService,
  ) {}

  // Không cần expected_*: chỉ giao phần còn lại đọc sau khi khóa → bấm lại là no-op
  async deliverAll(
    requestId: string,
    actor: string,
  ): Promise<DeliverAllResult> {
    const now = this.clock.now();
    return this.db.transaction(async (tx) => {
      const request = await this.lines.lockRequestLines(tx, requestId);
      if (!request) throw requestNotFound('Không tìm thấy phiếu.');
      await this.delivery.assertPeriodLocked(tx, request.period_ym, now);
      const open = request.lines.filter((l) => remainingOf(l) > 0);
      await this.stock.lockItemsWithin(tx, itemIdsOf(open));
      const result = await this.deliverEach(tx, open, actor, now);
      if (result.delivered.length > 0) {
        await this.lines.touchRequest(tx, requestId, now);
        await this.delivery.notifyIfComplete(tx, open[0], now);
      }
      return result;
    });
  }

  private async deliverEach(
    tx: Tx,
    lines: LockedLine[],
    actor: string,
    now: Date,
  ): Promise<DeliverAllResult> {
    const result: DeliverAllResult = { delivered: [], failed: [] };
    for (const line of lines) {
      const qty = remainingOf(line);
      try {
        await tx.transaction((sp) =>
          this.delivery.deliverWithin(sp, line, qty, actor, now),
        );
        result.delivered.push({ line_id: line.id, qty });
      } catch (error) {
        const failure = lineFailure(line.id, error);
        if (!failure) throw error;
        result.failed.push(failure);
      }
    }
    return result;
  }
}

function itemIdsOf(lines: LockedLine[]): string[] {
  return [...new Set(lines.flatMap((l) => (l.item_id ? [l.item_id] : [])))];
}

function lineFailure(lineId: string, error: unknown): DeliverAllFailure | null {
  if (!(error instanceof HttpException)) return null;
  const body = error.getResponse() as { code?: string; available?: number };
  if (!body.code || !LINE_FAILURES.has(body.code)) return null;
  return body.available === undefined
    ? { line_id: lineId, code: body.code }
    : { line_id: lineId, code: body.code, available: body.available };
}
