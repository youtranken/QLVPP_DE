import { sql } from 'drizzle-orm';
import type { Executor } from '../../database/database.module';
import { ITEM_ORDER } from '../catalog/item-order';
import {
  REMAINING_QTY,
  UNDELIVERED_LINE,
  lockedPeriod,
} from './line-predicates';

export interface OwedLine {
  name: string;
  name_en: string | null;
  unit: string;
  qty: number;
}

export interface OwedPeriod {
  ym: string;
  items: number;
  units: number;
  lines: OwedLine[];
}

type OwedRow = OwedLine & { ym: string };

// Phần chưa giao của mọi kỳ đã khóa (phần đã hủy không còn trong REMAINING_QTY), cũ trước
export async function owedPeriods(
  ex: Executor,
  userSub: string,
  openYm: string,
): Promise<OwedPeriod[]> {
  const { rows } = await ex.execute<OwedRow & Record<string, unknown>>(sql`
    SELECT to_char(r.period_ym, 'YYYY-MM') AS ym,
           coalesce(i.name, trim(l.custom_name)) AS name, i.name_en,
           coalesce(i.unit, trim(l.custom_unit)) AS unit,
           ${REMAINING_QTY}::int AS qty
    FROM requests r
    JOIN request_lines l ON l.request_id = r.id
    LEFT JOIN items i ON i.id = l.item_id
    LEFT JOIN item_categories c ON c.id = i.category_id
    WHERE r.user_sub = ${userSub} AND ${lockedPeriod(openYm)} AND ${UNDELIVERED_LINE}
    ORDER BY r.period_ym, ${ITEM_ORDER}, lower(l.custom_name) COLLATE "C", l.id
  `);
  const byYm = new Map<string, OwedPeriod>();
  for (const { ym, ...line } of rows) {
    const period = byYm.get(ym) ?? { ym, items: 0, units: 0, lines: [] };
    period.items += 1;
    period.units += line.qty;
    period.lines.push(line);
    byYm.set(ym, period);
  }
  return [...byYm.values()];
}
