import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { ClockService } from '../../common/clock.service';
import { DRIZZLE_DB } from '../../database/database.module';
import type { Database } from '../../database/database.module';
import { AuditWriterService } from '../audit/audit-writer.service';
import type { UndoResult } from '../undo/undo.dto';
import { UndoLedgerService } from '../undo/undo-ledger.service';
import { ITEM_COLUMNS } from './catalog-sql';
import type { ItemDbRow } from './catalog-sql';
import { itemConstraintError } from './item-errors';

@Injectable()
export class ItemUndoService {
  constructor(
    @Inject(DRIZZLE_DB) private readonly db: Database,
    private readonly clock: ClockService,
    private readonly ledger: UndoLedgerService,
    private readonly audit: AuditWriterService,
  ) {}

  // Chèn lại nguyên dòng đã chụp lúc xóa; mã trùng, nhóm/ảnh đã mất → lỗi ràng buộc có mã như khi tạo món
  async undoDeletes(ids: string[], actor: string): Promise<UndoResult> {
    const now = this.clock.now();
    try {
      return await this.db.transaction(async (tx) => {
        const rows = await this.ledger.claimWithin(tx, {
          ids,
          kind: 'item_delete',
          actor,
          now,
        });
        for (const r of rows) {
          const item = (r.payload as { item: Record<string, unknown> }).item;
          const after = (
            await tx.execute<ItemDbRow>(sql`
              INSERT INTO items
              SELECT * FROM jsonb_populate_record(NULL::items, ${JSON.stringify(item)}::jsonb)
              RETURNING ${ITEM_COLUMNS}
            `)
          ).rows[0];
          await this.audit.appendWithin(tx, {
            actor,
            action: 'item.delete_undone',
            objectType: 'item',
            objectId: after.id,
            detail: { before: null, after },
          });
        }
        return { undone: rows.length };
      });
    } catch (error) {
      throw itemConstraintError(error);
    }
  }
}
