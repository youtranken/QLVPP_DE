import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DRIZZLE_DB } from '../../database/database.module';
import type { Database } from '../../database/database.module';
import { AuditWriterService } from '../audit/audit-writer.service';
import type { ReceiptBody } from './stock.dto';
import { StockService } from './stock.service';

export interface ReceiptResult {
  items: { item_id: string; stock_qty: number; movement_id: string }[];
}

@Injectable()
export class StockReceiptService {
  constructor(
    @Inject(DRIZZLE_DB) private readonly db: Database,
    private readonly stock: StockService,
    private readonly audit: AuditWriterService,
  ) {}

  async receive(body: ReceiptBody, actor: string): Promise<ReceiptResult> {
    const lines = body.lines.map((l) => ({
      ...l,
      item_id: l.item_id.toLowerCase(),
    }));
    const ids = lines.map((l) => l.item_id);
    if (new Set(ids).size !== ids.length) {
      throw new BadRequestException({
        code: 'VALIDATION',
        message: 'Mỗi món chỉ xuất hiện một lần trong phiếu hàng về.',
        fields: ['lines'],
      });
    }
    const note = `Hàng về kỳ ${body.ym}${body.note ? ` · ${body.note}` : ''}`;
    return this.db.transaction(async (tx) => {
      await this.stock.lockItemsWithin(tx, ids);
      const current = new Map(
        (
          await tx.execute<{ id: string; stock_qty: number }>(sql`
            SELECT id, stock_qty FROM items
            WHERE id = ANY(${sql.param(ids)}::uuid[]) AND active
          `)
        ).rows.map((r) => [r.id, r.stock_qty]),
      );
      for (const l of lines) {
        const stockQty = current.get(l.item_id);
        if (stockQty === undefined) {
          throw new NotFoundException({
            code: 'ITEM_NOT_FOUND',
            message: 'Không tìm thấy món.',
            item_id: l.item_id,
          });
        }
        if (stockQty !== l.expected_stock_qty) {
          throw new ConflictException({
            code: 'STALE_UPDATE',
            message: 'Tồn kho vừa đổi ở nơi khác — tải lại rồi nhập lại.',
            item_id: l.item_id,
            stock_qty: stockQty,
          });
        }
      }
      const items: ReceiptResult['items'] = [];
      for (const l of lines) {
        const result = await this.stock.applyChangeWithin(
          tx,
          l.item_id,
          { delta: l.qty, reason: 'purchase', note },
          actor,
        );
        items.push({ item_id: l.item_id, ...result });
      }
      await this.audit.appendWithin(tx, {
        actor,
        action: 'stock.receipt',
        objectType: 'period',
        objectId: body.ym,
        detail: {
          lines: lines.map((l) => ({ item_id: l.item_id, qty: l.qty })),
          note: body.note ?? null,
        },
      });
      return { items };
    });
  }
}
