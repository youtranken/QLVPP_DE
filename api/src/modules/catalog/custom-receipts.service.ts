import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { ymToDate } from '../../common/period';
import { DRIZZLE_DB } from '../../database/database.module';
import type { Database } from '../../database/database.module';
import { AuditWriterService } from '../audit/audit-writer.service';
import { PeriodsService } from '../periods/periods.service';
import { latestSent } from '../reports/sent-snapshot';
import { itemAdmOut, markedKeys } from './adm-out.service';
import { customReceived, lockCustomKey } from './custom-key-lock';
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

const staleReceived = (lineKey: string, received: number) =>
  new ConflictException({
    code: 'STALE_UPDATE',
    message:
      'Số đã về vừa đổi ở nơi khác — đã cập nhật, kiểm tra lại trước khi ghi.',
    line_key: lineKey,
    received,
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
      // Khóa trước khi đọc dấu: đánh dấu cùng khóa giữ cùng khóa tư vấn
      await lockCustomKey(tx, ym, lk.key);
      if ((await markedKeys(tx, ym)).has(lk.key)) throw itemAdmOut(lk.key);
      const before = await customReceived(tx, ym, lk.key);
      if (before !== body.expected_received) {
        throw staleReceived(lk.key, before);
      }
      const { rows } = await tx.execute<{ id: string }>(sql`
        INSERT INTO custom_receipts (period_ym, line_key, qty, note, created_by, created_at)
        VALUES (${ymToDate(ym)}::date, ${lk.key}, ${body.qty}, ${body.note ?? null},
                ${actor}, ${now.toISOString()}::timestamptz)
        RETURNING id`);
      const { id } = rows[0];
      const received = before + body.qty;
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
          before: { received: before },
          after: { received },
        },
      });
      return { id, line_key: lk.key, qty: body.qty, received };
    });
  }
}
