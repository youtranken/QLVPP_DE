import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE_DB } from '../../database/database.module';
import type { Database } from '../../database/database.module';
import { StockQueryService } from '../catalog/stock-query.service';
import { PeriodsService } from '../periods/periods.service';
import { invalidPeriod } from '../requests/request-errors';
import { needOf } from './report-need';
import {
  customDemand,
  detailLines,
  itemDemand,
  pendingCustomCount,
} from './report-queries';
import type { CustomDemand, DetailLine, ItemDemand } from './report-queries';
import type {
  MonthReport,
  ReportCustomRow,
  ReportDepartment,
  ReportIssue,
  ReportItemRow,
} from './report.types';

// Đọc-only: join bảng của requests/catalog/users cho báo cáo (ngoại lệ CLAUDE.md)
@Injectable()
export class ReportsService {
  constructor(
    @Inject(DRIZZLE_DB) private readonly db: Database,
    private readonly periods: PeriodsService,
    private readonly stockQuery: StockQueryService,
  ) {}

  async build(ym: string, now: Date): Promise<MonthReport> {
    const open = await this.periods.openPeriod(this.db, now);
    if (ym > open.ym) throw invalidPeriod();
    const [items, custom, detail, pending, issues] = await Promise.all([
      itemDemand(this.db, ym),
      customDemand(this.db, ym),
      detailLines(this.db, ym),
      pendingCustomCount(this.db, ym),
      this.stockQuery.issuesInMonth(ym),
    ]);
    return {
      ym,
      generated_at: now.toISOString(),
      byItem: items.map(toItemRow),
      custom: custom.map(toCustomRow).sort(byName),
      byDepartment: groupDetail(detail),
      issues: issues.map(toIssue),
      pending_custom_count: pending,
    };
  }
}

function toItemRow(d: ItemDemand): ReportItemRow {
  return {
    key: d.item_id,
    ...d,
    need: needOf(d.requested, d.backlog_prev, d.stock),
  };
}

function toCustomRow(d: CustomDemand): ReportCustomRow {
  return {
    ...d,
    stock: null,
    need: needOf(d.requested, d.backlog_prev, null),
  };
}

function byName(a: ReportCustomRow, b: ReportCustomRow): number {
  return a.name.localeCompare(b.name, 'vi') || a.key.localeCompare(b.key);
}

// Dòng đã sắp theo phòng ban → người → món nên chỉ cần gom liên tiếp
function groupDetail(lines: DetailLine[]): ReportDepartment[] {
  const departments: ReportDepartment[] = [];
  for (const { department, user_sub, full_name, ...line } of lines) {
    let dept = departments.at(-1);
    if (!dept || dept.department !== department) {
      dept = { department, people: [] };
      departments.push(dept);
    }
    let person = dept.people.at(-1);
    if (!person || person.user_sub !== user_sub) {
      person = { user_sub, full_name, lines: [] };
      dept.people.push(person);
    }
    person.lines.push(line);
  }
  return departments;
}

function toIssue(row: Record<string, unknown>): ReportIssue {
  return {
    item_name: row.item_name as string,
    unit: row.unit as string,
    recipient_sub: row.recipient_sub as string | null,
    recipient_name: row.recipient_name as string | null,
    qty: Number(row.qty),
    reason: row.note as string,
    at: new Date(row.created_at as string | Date).toISOString(),
  };
}
