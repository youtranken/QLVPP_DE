import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { ClockService } from '../../common/clock.service';
import { addMonths, ymToDate } from '../../common/period';
import { DRIZZLE_DB } from '../../database/database.module';
import type { Database } from '../../database/database.module';
import { PeriodsService } from '../periods/periods.service';
import { hasItemsSql } from '../reports/sent-snapshot';
import {
  CUSTOM_ITEM_KEY,
  REMAINING_QTY,
  UNDELIVERED_LINE,
  lockedPeriod,
} from '../requests/line-predicates';
import { lineNotFound } from '../requests/request-errors';
import type {
  BacklogBy,
  BacklogGroup,
  BacklogLine,
  LineDeliveries,
} from './delivery.dto';

type BacklogRow = BacklogLine & {
  item_key: string;
  user_department: string | null;
} & Record<string, unknown>;

// Đọc-only cho màn Còn nợ: join bảng của requests/catalog/users như báo cáo
@Injectable()
export class BacklogService {
  constructor(
    @Inject(DRIZZLE_DB) private readonly db: Database,
    private readonly clock: ClockService,
    private readonly periods: PeriodsService,
  ) {}

  async backlog(by: BacklogBy): Promise<{ groups: BacklogGroup[] }> {
    const open = await this.periods.openPeriod(this.db, this.clock.now());
    const rows = await this.backlogRows(open.ym);
    const groups = new Map<string, BacklogGroup>();
    for (const { item_key, user_department, ...line } of rows) {
      const key = by === 'item' ? item_key : line.user_sub;
      let group = groups.get(key);
      if (!group) {
        group = {
          key,
          label: labelOf(by, line, user_department),
          remaining_qty: 0,
          lines: [],
        };
        groups.set(key, group);
      }
      group.remaining_qty += line.remaining_qty;
      group.lines.push(line);
    }
    return { groups: [...groups.values()].sort(byLabel) };
  }

  // Chỉ kỳ đã khóa: kỳ đang mở chưa giao được nên chưa phải nợ
  private async backlogRows(openYm: string): Promise<BacklogRow[]> {
    const lastLocked = ymToDate(addMonths(openYm, -1));
    const key = sql`coalesce(l.item_id::text, ${CUSTOM_ITEM_KEY})`;
    const { rows } = await this.db.execute<BacklogRow>(sql`
      WITH sent AS (
        SELECT data FROM report_snapshots
        WHERE period_ym = ${lastLocked}::date AND ${hasItemsSql}
        ORDER BY created_at DESC, id DESC LIMIT 1
      )
      SELECT l.id AS line_id, l.request_id, to_char(r.period_ym, 'YYYY-MM') AS period_ym,
             r.user_sub, u.full_name, r.department, u.status AS user_status,
             u.department AS user_department, l.item_id,
             coalesce(i.name, trim(l.custom_name)) AS name, i.name_en,
             coalesce(i.unit, trim(l.custom_unit)) AS unit,
             l.qty, l.delivered_qty, l.cancelled_qty, ${REMAINING_QTY} AS remaining_qty,
             i.stock_qty,
             ${key} AS item_key,
             CASE WHEN sent.data IS NULL THEN NULL
                  ELSE LEAST(${REMAINING_QTY}, coalesce(
                    (sent.data->'order_basis'->${key}->>'debt')::int,
                    (SELECT (e->>'backlog_prev')::int
                     FROM jsonb_array_elements(coalesce(sent.data->'byItem', '[]') || coalesce(sent.data->'custom', '[]')) e
                     WHERE e->>'key' = ${key}),
                    0)) END AS counted_in_snapshot_qty
      FROM request_lines l
      JOIN requests r ON r.id = l.request_id
      JOIN users u ON u.sub = r.user_sub
      LEFT JOIN items i ON i.id = l.item_id
      LEFT JOIN sent ON r.period_ym < ${lastLocked}::date
      WHERE ${UNDELIVERED_LINE} AND ${lockedPeriod(openYm)}
      ORDER BY r.period_ym, coalesce(u.full_name, ''), l.id
    `);
    return rows;
  }

  async deliveries(lineId: string): Promise<LineDeliveries> {
    const ym = await this.periods.assertLineLocked(
      this.db,
      lineId,
      this.clock.now(),
    );
    if (!ym) throw lineNotFound();
    const head = await this.db.execute<
      LineDeliveries['line'] & Record<string, unknown>
    >(sql`
      SELECT id, qty, delivered_qty, cancelled_qty, cancel_note
      FROM request_lines WHERE id = ${lineId}
    `);
    if (head.rows.length === 0) throw lineNotFound();
    const { rows } = await this.db.execute<
      Omit<LineDeliveries['items'][number], 'created_at'> & {
        created_at: Date | string;
      } & Record<string, unknown>
    >(sql`
      SELECT d.id, d.qty, d.movement_id, d.actor_sub, u.full_name AS actor_name, d.created_at
      FROM line_deliveries d LEFT JOIN users u ON u.sub = d.actor_sub
      WHERE d.line_id = ${lineId}
      ORDER BY d.created_at, d.seq
    `);
    return {
      line: head.rows[0],
      items: rows.map((r) => ({
        ...r,
        created_at: new Date(r.created_at).toISOString(),
      })),
    };
  }
}

function labelOf(
  by: BacklogBy,
  line: BacklogLine,
  userDepartment: string | null,
): BacklogGroup['label'] {
  return by === 'item'
    ? { item_id: line.item_id, name: line.name, unit: line.unit }
    : {
        user_sub: line.user_sub,
        full_name: line.full_name,
        department: userDepartment,
      };
}

function byLabel(a: BacklogGroup, b: BacklogGroup): number {
  const name = (g: BacklogGroup) => g.label.name ?? g.label.full_name ?? '';
  return name(a).localeCompare(name(b), 'vi') || a.key.localeCompare(b.key);
}
