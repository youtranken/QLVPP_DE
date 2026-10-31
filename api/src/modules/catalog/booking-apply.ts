import { sql } from 'drizzle-orm';
import type { Database, Tx } from '../../database/database.module';
import { AuditWriterService } from '../audit/audit-writer.service';
import { SystemConfigService } from '../config/system-config.service';
import { UnitsService, type UnitRow } from '../units/units.service';
import {
  bookingItemProblem,
  type BookingItem,
  type BookingNeedCode,
  type BookingSkip,
  type ParsedBooking,
} from './booking-import';

export const IMPORT_ACTOR = 'system:import';

export interface BookingImportResult {
  applied: boolean;
  created: BookingItem[];
  skipped: BookingSkip[];
  needCode: BookingNeedCode[];
  unitsCreated: { code: string; name: string }[];
}

class BookingImporter {
  private readonly audit: AuditWriterService;
  private readonly units: UnitsService;
  private readonly unitsByName = new Map<string, UnitRow>();

  constructor(
    private readonly db: Database,
    private readonly result: BookingImportResult,
  ) {
    this.audit = new AuditWriterService(db);
    this.units = new UnitsService(db, this.audit);
  }

  async run(tx: Tx, parsed: ParsedBooking): Promise<void> {
    const maxQty = await new SystemConfigService(this.db).getInt(
      'default_max_qty',
    );
    for (const item of parsed.items) {
      const problem = bookingItemProblem(item);
      if (problem) {
        throw new Error(`Hàng ${item.row}: ${problem} quá dài — không nạp gì.`);
      }
      const existing = await this.existingReason(tx, item);
      if (existing) {
        this.result.skipped.push(skip(item, existing));
        continue;
      }
      const unit = await this.unit(tx, item.unitName);
      // SPEC §11.1: món mới không được dùng ĐVT đã ngừng — bỏ hàng, báo để Hành chính sửa file
      if (!unit.active) {
        this.result.skipped.push(skip(item, 'unit_inactive'));
        continue;
      }
      await tx.execute(sql`
        INSERT INTO items (code, name, name_en, unit, pack_note, max_qty, sort_order)
        VALUES (${item.code}, ${item.name}, ${item.nameEn}, ${unit.code},
                ${item.packNote}, ${maxQty}, ${item.sortOrder})
      `);
      this.result.created.push(item);
    }
    const createdRows = new Set(this.result.created.map((i) => i.row));
    this.result.needCode = parsed.needCode.filter((n) =>
      createdRows.has(n.row),
    );
    await this.audit.appendWithin(tx, {
      actor: IMPORT_ACTOR,
      action: 'catalog.imported',
      objectType: 'catalog',
      detail: {
        created: this.result.created.length,
        skipped: this.result.skipped.length,
        units_created: this.result.unitsCreated.map((u) => u.code),
      },
    });
  }

  // Không ghi đè món đã có: khớp mã, hoặc tên không phân biệt hoa thường khi hàng không mã
  private async existingReason(
    tx: Tx,
    item: BookingItem,
  ): Promise<BookingSkip['reason'] | null> {
    const { rows } = await tx.execute(
      item.code
        ? sql`SELECT 1 FROM items WHERE code = ${item.code}`
        : sql`SELECT 1 FROM items WHERE lower(name) = lower(${item.name})`,
    );
    if (rows.length === 0) return null;
    return item.code ? 'exists_code' : 'exists_name';
  }

  private async unit(tx: Tx, name: string): Promise<UnitRow> {
    const known = this.unitsByName.get(name);
    if (known) return known;
    const { unit, created } = await this.units.findOrCreateWithin(
      tx,
      name,
      IMPORT_ACTOR,
    );
    if (created) this.result.unitsCreated.push({ code: unit.code, name });
    this.unitsByName.set(name, unit);
    return unit;
  }
}

const skip = (
  item: BookingItem,
  reason: BookingSkip['reason'],
): BookingSkip => ({ row: item.row, code: item.code, name: item.name, reason });

// Lỗi riêng thay tx.rollback(): script .mjs và dist CJS nạp hai bản drizzle, instanceof lệch lớp
const DRY_RUN = new Error('booking dry-run rollback');

// Chạy thử đi đúng đường ghi rồi rollback, để báo cáo khớp hệt lần --apply
export async function applyBookingImport(
  db: Database,
  parsed: ParsedBooking,
  opts: { apply: boolean },
): Promise<BookingImportResult> {
  const result: BookingImportResult = {
    applied: opts.apply,
    created: [],
    skipped: [...parsed.skipped],
    needCode: [],
    unitsCreated: [],
  };
  try {
    await db.transaction(async (tx) => {
      await new BookingImporter(db, result).run(tx, parsed);
      if (!opts.apply) throw DRY_RUN;
    });
  } catch (error) {
    if (error !== DRY_RUN) throw error;
  }
  return result;
}
