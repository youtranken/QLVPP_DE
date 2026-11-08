import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { ymToDate } from '../../common/period';
import { DRIZZLE_DB } from '../../database/database.module';
import type { Database } from '../../database/database.module';
import { CatalogService } from '../catalog/catalog.service';
import { CUSTOM_ITEM_KEY, EFFECTIVE_LINE } from './line-predicates';
import { SummaryService } from './summary.service';

export interface ItemPerson {
  request_id: string;
  user_sub: string;
  full_name: string | null;
  email: string | null;
  team: string | null;
  qty: number;
  before: number | null;
  reason_code: string | null;
  reason_note: string | null;
}

export interface ItemPeople {
  key: string;
  name: string;
  unit: string;
  requested: number;
  after: number;
  people: ItemPerson[];
}

type Row = ItemPerson & {
  custom_name: string | null;
  custom_unit: string | null;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Cùng khóa gộp với CUSTOM_ITEM_KEY nhưng cho bản ghi điều chỉnh (name/unit đã chụp)
const ADJUSTED_KEY = sql.raw(
  `('custom:' || jsonb_build_array(lower(trim(a.name)), lower(trim(a.unit)))::text)`,
);

// Ai đăng ký một món của kỳ: dòng hiệu lực hợp dòng đã bị Hành chính bỏ (chỉ còn bản ghi điều chỉnh); đọc-only
@Injectable()
export class ItemPeopleService {
  constructor(
    @Inject(DRIZZLE_DB) private readonly db: Database,
    private readonly summary: SummaryService,
    private readonly catalog: CatalogService,
  ) {}

  async list(ym: string, key: string): Promise<ItemPeople> {
    await this.summary.assertViewable(ym);
    const period = ymToDate(ym);
    const itemId = UUID.test(key) ? key : null;
    const { rows } = await this.db.execute<Row & Record<string, unknown>>(sql`
      WITH cur AS (
        SELECT r.id AS request_id, l.id AS line_id, l.qty,
               trim(l.custom_name) AS custom_name, trim(l.custom_unit) AS custom_unit,
               (SELECT a.qty_before FROM request_line_adjustments a WHERE a.line_id = l.id
                 ORDER BY a.created_at, a.id LIMIT 1) AS before,
               (SELECT a.reason_code FROM request_line_adjustments a WHERE a.line_id = l.id
                 ORDER BY a.created_at DESC, a.id DESC LIMIT 1) AS reason_code,
               (SELECT a.reason_note FROM request_line_adjustments a WHERE a.line_id = l.id
                 ORDER BY a.created_at DESC, a.id DESC LIMIT 1) AS reason_note
        FROM requests r JOIN request_lines l ON l.request_id = r.id
        WHERE r.period_ym = ${period}::date AND ${EFFECTIVE_LINE}
          AND coalesce(l.item_id::text, ${CUSTOM_ITEM_KEY}) = ${key}
      ), gone AS (
        SELECT a.request_id, a.line_id, 0 AS qty,
               min(a.name) AS custom_name, min(a.unit) AS custom_unit,
               (array_agg(a.qty_before ORDER BY a.created_at, a.id))[1] AS before,
               (array_agg(a.reason_code ORDER BY a.created_at DESC, a.id DESC))[1] AS reason_code,
               (array_agg(a.reason_note ORDER BY a.created_at DESC, a.id DESC))[1] AS reason_note
        FROM request_line_adjustments a
        JOIN requests r ON r.id = a.request_id
        WHERE r.period_ym = ${period}::date AND a.qty_after = 0
          AND NOT EXISTS (SELECT 1 FROM request_lines x WHERE x.id = a.line_id)
          AND (CASE WHEN a.item_id IS NOT NULL THEN a.item_id::text ELSE ${ADJUSTED_KEY} END) = ${key}
        GROUP BY a.request_id, a.line_id
      ), merged AS (SELECT * FROM cur UNION ALL SELECT * FROM gone)
      SELECT m.request_id, r.user_sub, u.full_name, u.email, u.team,
             sum(m.qty)::int AS qty,
             CASE WHEN bool_or(m.before IS NOT NULL)
                  THEN sum(coalesce(m.before, m.qty))::int END AS before,
             max(m.reason_code) AS reason_code, max(m.reason_note) AS reason_note,
             min(m.custom_name) AS custom_name, min(m.custom_unit) AS custom_unit
      FROM merged m
      JOIN requests r ON r.id = m.request_id
      JOIN users u ON u.sub = r.user_sub
      GROUP BY m.request_id, r.user_sub, u.full_name, u.email, u.team
      ORDER BY qty DESC, u.full_name, m.request_id
    `);
    const facts = itemId
      ? (await this.catalog.itemFacts([itemId])).get(itemId)
      : undefined;
    const people = rows.map<ItemPerson>((r) => ({
      request_id: r.request_id,
      user_sub: r.user_sub,
      full_name: r.full_name,
      email: r.email,
      team: r.team,
      qty: r.qty,
      before: r.before,
      reason_code: r.reason_code,
      reason_note: r.reason_note,
    }));
    return {
      key,
      name: facts?.name ?? rows[0]?.custom_name ?? '',
      unit: facts?.unit ?? rows[0]?.custom_unit ?? '',
      requested: people.reduce((s, p) => s + (p.before ?? p.qty), 0),
      after: people.reduce((s, p) => s + p.qty, 0),
      people,
    };
  }
}
