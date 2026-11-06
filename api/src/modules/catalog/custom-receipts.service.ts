import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { ymToDate } from '../../common/period';
import { DRIZZLE_DB } from '../../database/database.module';
import type { Database } from '../../database/database.module';
import { AuditWriterService } from '../audit/audit-writer.service';
import { PeriodsService } from '../periods/periods.service';
import { latestSent } from '../reports/sent-snapshot';
import { itemAdmOut, markedKeys } from './adm-out.service';
import { invalidLineKey, parseLineKey } from './line-key';
import type { CustomReceiptBody } from './stock.dto';

export interface CustomReceiptResult {
  id: string;
  line_key: string;
  qty: number;
  received: number;
}

const notInPrint = () =>
  new NotFoundException({
    code: 'ITEM_NOT_FOUND',
    message: 'Món ngoài danh mục này không có trong bản in của kỳ.',
  });

// Hàng ngoài danh mục không vào tủ: chỉ ghi số đã về để làm trần giao theo khóa
@Injectable()
export class CustomReceiptsService {
  constructor(
    @Inject(DRIZZLE_DB) private readonly db: Database,
    private readonly periods: PeriodsService,
    private readonly audit: AuditWriterService,
  ) {}

  async receive(
    ym: string,
    body: CustomReceiptBody,
    actor: string,
    now: Date,
  ): Promise<CustomReceiptResult> {
    const lk = parseLineKey(body.line_key);
    if (!lk || lk.item_id) throw invalidLineKey();
    await this.periods.assertLocked(ym, now);
    return this.db.transaction(async (tx) => {
      const sent = await latestSent(tx, ym);
      if (!sent || !((sent.data.order_qty[lk.key] ?? 0) > 0)) {
        throw notInPrint();
      }
      if ((await markedKeys(tx, ym)).has(lk.key)) throw itemAdmOut(lk.key);
      const { rows } = await tx.execute<{ id: string; received: number }>(sql`
        WITH ins AS (
          INSERT INTO custom_receipts (period_ym, line_key, qty, note, created_by, created_at)
          VALUES (${ymToDate(ym)}::date, ${lk.key}, ${body.qty}, ${body.note ?? null},
                  ${actor}, ${now.toISOString()}::timestamptz)
          RETURNING id, qty
        )
        SELECT ins.id, (ins.qty + coalesce((SELECT sum(qty) FROM custom_receipts
                         WHERE period_ym = ${ymToDate(ym)}::date AND line_key = ${lk.key}), 0))::int AS received
        FROM ins`);
      const { id, received } = rows[0];
      await this.audit.appendWithin(tx, {
        actor,
        action: 'arrival.custom_received',
        objectType: 'period',
        objectId: ym,
        detail: {
          id,
          line_key: lk.key,
          qty: body.qty,
          note: body.note ?? null,
          before: { received: received - body.qty },
          after: { received },
        },
      });
      return { id, line_key: lk.key, qty: body.qty, received };
    });
  }
}
