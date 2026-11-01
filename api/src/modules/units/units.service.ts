import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { pgViolation } from '../../common/sql';
import { DRIZZLE_DB } from '../../database/database.module';
import type { Database, Executor, Tx } from '../../database/database.module';
import { AuditWriterService } from '../audit/audit-writer.service';
import { definedEntries, pick, setClause } from '../../common/sql-patch';
import { unitCodeFrom } from './unit-code';
import {
  unitChoiceError,
  unitExists,
  unitInUse,
  unitNotFound,
} from './unit-errors';
import type { CreateUnitDto, UpdateUnitDto } from './units.dto';

export interface UnitRow extends Record<string, unknown> {
  code: string;
  name: string;
  name_en: string | null;
  sort_order: number;
  active: boolean;
}

export type UnitFacts = Pick<UnitRow, 'name' | 'name_en' | 'active'>;

const COLUMNS = sql.raw('code, name, name_en, sort_order, active');
const ORDER = sql.raw('ORDER BY sort_order, lower(name), code');
// Đọc-only để chặn xóa trước khi chạm FK RESTRICT; FK vẫn là chốt chặn cuối khi đua
const IN_USE = sql.raw(
  `(EXISTS (SELECT 1 FROM items i WHERE i.unit = units.code)
    OR EXISTS (SELECT 1 FROM request_lines l WHERE l.custom_unit = units.code))`,
);
const CODE_LOCK = sql.raw("hashtext('units.code')");

const factsByCode = (rows: UnitRow[]): Map<string, UnitFacts> =>
  new Map(
    rows.map((r) => [
      r.code,
      { name: r.name, name_en: r.name_en, active: r.active },
    ]),
  );

@Injectable()
export class UnitsService {
  constructor(
    @Inject(DRIZZLE_DB) private readonly db: Database,
    private readonly audit: AuditWriterService,
  ) {}

  // Gồm cả ĐVT đã ngừng: nhân viên vẫn thấy đúng tên ĐVT trên dòng cũ
  async list(): Promise<UnitRow[]> {
    const { rows } = await this.db.execute<UnitRow>(sql`
      SELECT ${COLUMNS} FROM units ${ORDER}
    `);
    return rows;
  }

  async listWithUsage(): Promise<
    (UnitRow & { in_use: boolean; item_count: number })[]
  > {
    const { rows } = await this.db.execute<
      UnitRow & { in_use: boolean; item_count: number }
    >(sql`
      SELECT ${COLUMNS}, ${IN_USE} AS in_use,
             (SELECT count(*)::int FROM items i WHERE i.unit = units.code) AS item_count
      FROM units ${ORDER}
    `);
    return rows;
  }

  // Gồm cả ĐVT đã ngừng: món và dòng phiếu cũ vẫn phải hiện đúng tên
  async namesByCode(tx: Executor = this.db): Promise<Map<string, UnitFacts>> {
    const { rows } = await tx.execute<UnitRow>(
      sql`SELECT ${COLUMNS} FROM units`,
    );
    return factsByCode(rows);
  }

  async inactiveCodes(tx: Executor = this.db): Promise<Set<string>> {
    const { rows } = await tx.execute<{ code: string }>(
      sql`SELECT code FROM units WHERE NOT active`,
    );
    return new Set(rows.map((r) => r.code));
  }

  // FOR SHARE: ngừng/xóa ĐVT phải chờ tx đang chọn ĐVT này commit (và ngược lại)
  async lockFacts(
    codes: string[],
    tx: Executor,
  ): Promise<Map<string, UnitFacts>> {
    if (codes.length === 0) return new Map();
    const { rows } = await tx.execute<UnitRow>(sql`
      SELECT ${COLUMNS} FROM units
      WHERE code = ANY(${sql.param(codes)}::text[])
      ORDER BY code FOR SHARE
    `);
    return factsByCode(rows);
  }

  async assertActive(
    code: string,
    tx: Executor,
    field = 'unit',
  ): Promise<void> {
    const error = unitChoiceError(
      (await this.lockFacts([code], tx)).get(code),
      field,
    );
    if (error) throw error;
  }

  async create(dto: CreateUnitDto, actor: string): Promise<UnitRow> {
    return this.mapViolations(() =>
      this.db.transaction((tx) => this.insertWithin(tx, dto, actor)),
    );
  }

  async findByCodeWithin(tx: Tx, code: string): Promise<UnitRow | null> {
    const { rows } = await tx.execute<UnitRow>(sql`
      SELECT ${COLUMNS} FROM units WHERE code = ${code}
    `);
    return rows[0] ?? null;
  }

  // Nạp danh mục: khớp tên không phân biệt hoa thường (không theo slug — cuốn ≠ cuộn), chưa có thì tạo
  async findOrCreateWithin(
    tx: Tx,
    name: string,
    actor: string,
  ): Promise<{ unit: UnitRow; created: boolean }> {
    const { rows } = await tx.execute<UnitRow>(sql`
      SELECT ${COLUMNS} FROM units WHERE lower(name) = lower(${name})
    `);
    if (rows[0]) return { unit: rows[0], created: false };
    const { rows: last } = await tx.execute<{ max: number | null }>(
      sql`SELECT max(sort_order) AS max FROM units`,
    );
    const sort_order = (last[0]?.max ?? 0) + 10;
    const unit = await this.insertWithin(tx, { name, sort_order }, actor);
    return { unit, created: true };
  }

  private async insertWithin(
    tx: Tx,
    dto: CreateUnitDto,
    actor: string,
  ): Promise<UnitRow> {
    const code = await this.newCode(tx, dto.name);
    const fields = { ...definedEntries(dto), code };
    const row = (
      await tx.execute<UnitRow>(sql`
        INSERT INTO units (${sql.join(
          Object.keys(fields).map((k) => sql.identifier(k)),
          sql`, `,
        )})
        VALUES (${sql.join(
          Object.values(fields).map((v) => sql`${v}`),
          sql`, `,
        )})
        RETURNING ${COLUMNS}
      `)
    ).rows[0];
    await this.audit.appendWithin(tx, {
      actor,
      action: 'unit.created',
      objectType: 'unit',
      objectId: code,
      detail: { after: row },
    });
    return row;
  }

  async update(
    code: string,
    dto: UpdateUnitDto,
    actor: string,
  ): Promise<UnitRow> {
    const patch = definedEntries(dto);
    return this.mapViolations(() =>
      this.db.transaction(async (tx) => {
        const before = await this.lockRow(tx, code);
        if (Object.keys(patch).length === 0) return before;
        const after = (
          await tx.execute<UnitRow>(sql`
            UPDATE units SET ${setClause(patch)}, updated_at = now()
            WHERE code = ${code} RETURNING ${COLUMNS}
          `)
        ).rows[0];
        const keys = Object.keys(patch);
        await this.audit.appendWithin(tx, {
          actor,
          action: 'unit.updated',
          objectType: 'unit',
          objectId: code,
          detail: { before: pick(before, keys), after: pick(after, keys) },
        });
        return after;
      }),
    );
  }

  async remove(code: string, actor: string): Promise<void> {
    await this.mapViolations(() =>
      this.db.transaction(async (tx) => {
        const before = await this.lockRow(tx, code);
        const { rows } = await tx.execute<{ in_use: boolean }>(sql`
          SELECT ${IN_USE} AS in_use FROM units WHERE code = ${code}
        `);
        if (rows[0].in_use) throw unitInUse();
        await tx.execute(sql`DELETE FROM units WHERE code = ${code}`);
        await this.audit.appendWithin(tx, {
          actor,
          action: 'unit.deleted',
          objectType: 'unit',
          objectId: code,
          detail: { before },
        });
      }),
    );
  }

  private async lockRow(tx: Tx, code: string): Promise<UnitRow> {
    const row = (
      await tx.execute<UnitRow>(sql`
        SELECT ${COLUMNS} FROM units WHERE code = ${code} FOR UPDATE
      `)
    ).rows[0];
    if (!row) throw unitNotFound();
    return row;
  }

  // Khóa tư vấn: hai tên khác nhau cùng ra một code gốc không giẫm PK của nhau
  private async newCode(tx: Tx, name: string): Promise<string> {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(${CODE_LOCK})`);
    const { rows } = await tx.execute<{ code: string }>(
      sql`SELECT code FROM units`,
    );
    return unitCodeFrom(name, new Set(rows.map((r) => r.code)));
  }

  private async mapViolations<T>(run: () => Promise<T>): Promise<T> {
    try {
      return await run();
    } catch (error) {
      const v = pgViolation(error);
      if (v?.constraint === 'units_name_uq') throw unitExists();
      if (v?.code === '23001' || v?.code === '23503') throw unitInUse();
      throw error;
    }
  }
}
