export interface ReportItemRow {
  key: string;
  item_id: string;
  name: string;
  name_en: string | null;
  unit: string;
  pack_note: string | null;
  active: boolean;
  requested: number;
  backlog_prev: number;
  stock: number;
  need: number;
}

export interface ReportCustomRow {
  key: string;
  name: string;
  unit: string;
  requested: number;
  backlog_prev: number;
  stock: null;
  need: number;
  people: number;
}

export interface ReportDetailLine {
  name: string;
  name_en: string | null;
  unit: string;
  qty: number;
}

export interface ReportDepartment {
  department: string | null;
  people: {
    user_sub: string;
    full_name: string | null;
    lines: ReportDetailLine[];
  }[];
}

export interface ReportIssue {
  item_name: string;
  unit: string;
  recipient_sub: string | null;
  recipient_name: string | null;
  qty: number;
  reason: string;
  at: string;
}

export interface MonthReport {
  ym: string;
  generated_at: string;
  byItem: ReportItemRow[];
  custom: ReportCustomRow[];
  byDepartment: ReportDepartment[];
  issues: ReportIssue[];
  pending_custom_count: number;
}
