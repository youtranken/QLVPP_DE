import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { ClockService } from '../../common/clock.service';
import { DRIZZLE_DB } from '../../database/database.module';
import type { Database, Tx } from '../../database/database.module';
import { addMonths } from '../../common/period';
import { latestSent } from '../reports/sent-snapshot';
import { itemAdmOut, markedKeys } from './adm-out.service';
import { AuditWriterService } from '../audit/audit-writer.service';
import { PeriodsService } from '../periods/periods.service';
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
    private readonly periods: PeriodsService,
    private readonly clock: ClockService,
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
    const now = this.clock.now();
    await this.periods.assertLocked(body.ym, now);
    const note = `${await this.notePrefix(body.ym, now)}${body.note ? ` · ${body.note}` : ''}`;
    return this.db.transaction(async (tx) => {
      await this.stock.lockItemsWithin(tx, ids);
      await this.assertReceivable(tx, body.ym, lines);
      // Dòng gộp ghi trước để từng món mang id của nó (batch_id) — Nhật ký hiện một lần Lưu thành một dòng.
      // Ghi kèm tên lúc Lưu để Nhật ký vẫn đọc được khi món bị xóa sau này
      const names = await this.namesWithin(tx, ids);
      const batchId = await this.audit.appendWithin(tx, {
        actor,
        action: 'stock.receipt',
        objectType: 'period',
        objectId: body.ym,
        detail: {
          lines: lines.map((l) => ({
            item_id: l.item_id,
            qty: l.qty,
            name: names.get(l.item_id)?.name ?? null,
            name_en: names.get(l.item_id)?.name_en ?? null,
          })),
          note: body.note ?? null,
        },
      });
      const items: ReceiptResult['items'] = [];
      for (const l of lines) {
        const result = await this.stock.applyChangeWithin(
          tx,
          l.item_id,
          {
            delta: l.qty,
            reason: 'purchase',
            note,
            receiptYm: body.ym,
            batchId,
          },
          actor,
        );
        items.push({ item_id: l.item_id, ...result });
      }
      return { items };
    });
  }

  private async namesWithin(
    tx: Tx,
    ids: string[],
  ): Promise<Map<string, { name: string; name_en: string | null }>> {
    const { rows } = await tx.execute<{
      id: string;
      name: string;
      name_en: string | null;
    }>(
      sql`SELECT id::text, name, name_en FROM items WHERE id = ANY(${sql.param(ids)}::uuid[])`,
    );
    return new Map(
      rows.map((r) => [r.id, { name: r.name, name_en: r.name_en }]),
    );
  }

  // Kỳ trước kỳ làm việc = ADM giao bù phần còn nợ của kỳ đó
  private async notePrefix(ym: string, now: Date): Promise<string> {
    const working = addMonths(
      (await this.periods.openPeriod(this.db, now)).ym,
      -1,
    );
    return ym < working ? `Về bù kỳ ${ym}` : `Hàng về kỳ ${ym}`;
  }

  // Món ngừng vẫn nhận nếu bản in của kỳ đã đặt (đã đặt thì phải nhận); món đánh "ADM hết hàng" của kỳ thì không
  private async assertReceivable(
    tx: Tx,
    ym: string,
    lines: ReceiptBody['lines'],
  ): Promise<void> {
    const ids = lines.map((l) => l.item_id);
    const { rows } = await tx.execute<{
      id: string;
      stock_qty: number;
      active: boolean;
    }>(sql`
      SELECT id, stock_qty, active FROM items WHERE id = ANY(${sql.param(ids)}::uuid[])
    `);
    const current = new Map(rows.map((r) => [r.id, r]));
    const ordered = (await latestSent(tx, ym))?.data.order_qty ?? {};
    for (const l of lines) {
      const item = current.get(l.item_id);
      if (!item || (!item.active && !((ordered[l.item_id] ?? 0) > 0))) {
        throw new NotFoundException({
          code: 'ITEM_NOT_FOUND',
          message: 'Không tìm thấy món.',
          item_id: l.item_id,
        });
      }
    }
    const marked = await markedKeys(tx, ym);
    const out = lines.find((l) => marked.has(l.item_id));
    if (out) throw itemAdmOut(out.item_id);
    for (const l of lines) {
      const stockQty = current.get(l.item_id)!.stock_qty;
      if (stockQty !== l.expected_stock_qty) {
        throw new ConflictException({
          code: 'STALE_UPDATE',
          message: 'Tồn kho vừa đổi ở nơi khác — tải lại rồi nhập lại.',
          item_id: l.item_id,
          stock_qty: stockQty,
        });
      }
    }
  }
}
