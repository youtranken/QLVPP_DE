import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE_DB } from '../../database/database.module';
import type { Database, Executor } from '../../database/database.module';
import { StockQueryService } from '../catalog/stock-query.service';
import { PeriodsService } from '../periods/periods.service';
import { admOwedByKey } from './order-default';
import { needOf } from './report-need';
import {
  customDemand,
  detailLines,
  itemDemand,
  pendingCustomCount,
  pendingCustomLines,
  periodProgress,
} from './report-queries';
import type {
  CustomDemand,
  DetailLine,
  ItemDemand,
  KeyProgress,
  PendingCustomLine,
} from './report-queries';
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

  // Bản chốt truyền tx REPEATABLE READ để mọi phần đọc cùng một ảnh dữ liệu
  async build(
    ym: string,
    now: Date,
    db: Executor = this.db,
  ): Promise<MonthReport> {
    await this.periods.assertLocked(ym, now, db);
    // Tuần tự: tx chỉ có một client, pg không cho chồng truy vấn trên cùng client
    const items = await itemDemand(db, ym);
    const custom = await customDemand(db, ym);
    const detail = await detailLines(db, ym);
    const pending = await pendingCustomCount(db, ym);
    const issues = await this.stockQuery.issuesInMonth(ym, db);
    const owed = await admOwedByKey(db, ym);
    return {
      ym,
      generated_at: now.toISOString(),
      byItem: items.map((d) => toItemRow(d, owed.get(d.item_id) ?? 0)),
      custom: custom
        .map((d) => toCustomRow(d, owed.get(d.key) ?? 0))
        .sort(byName),
      byDepartment: groupDetail(detail),
      issues: issues.map(toIssue),
      pending_custom_count: pending,
    };
  }

  // Báo cáo sống (không vào bản chốt): cột Đăng ký/Đã giao/Đã về để đối chiếu với bản đã gửi,
  // tên món ngoài danh mục còn chờ cho cảnh báo lúc chốt
  async live(
    ym: string,
    now: Date,
  ): Promise<
    MonthReport & {
      progress: Record<string, KeyProgress>;
      pending_custom: PendingCustomLine[];
    }
  > {
    // Ba truy vấn độc lập: chạy song song; số món chờ lấy từ chính danh sách tên để hai con số không lệch nhau
    const [report, progress, pending] = await Promise.all([
      this.build(ym, now),
      periodProgress(this.db, ym),
      pendingCustomLines(this.db, ym),
    ]);
    return {
      ...report,
      progress,
      pending_custom: pending,
      pending_custom_count: pending.length,
    };
  }
}

function toItemRow(d: ItemDemand, admOwed: number): ReportItemRow {
  return {
    key: d.item_id,
    ...d,
    need: needOf(d.requested, d.backlog_prev, d.stock),
    adm_owed: admOwed,
  };
}

function toCustomRow(d: CustomDemand, admOwed: number): ReportCustomRow {
  return {
    ...d,
    stock: null,
    need: needOf(d.requested, d.backlog_prev, null),
    adm_owed: admOwed,
    usable: true,
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
    item_name_en: row.item_name_en as string | null,
    unit: row.unit as string,
    recipient_sub: row.recipient_sub as string | null,
    recipient_name: row.recipient_name as string | null,
    qty: Number(row.qty),
    reason: row.note as string,
    at: new Date(row.created_at as string | Date).toISOString(),
  };
}
