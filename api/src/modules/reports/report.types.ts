import type { SignatureBox } from '../config/config-validation';

export type { SignatureBox };

// Tên ĐVT chụp lúc chốt để bản in/Excel đứng yên khi ĐVT đổi tên; báo cáo sống và bản chốt cũ không có
export interface FrozenUnitName {
  unit_name?: string;
  unit_name_en?: string | null;
}

export interface ReportItemRow extends FrozenUnitName {
  key: string;
  item_id: string;
  code: string | null;
  name: string;
  name_en: string | null;
  unit: string;
  pack_note: string | null;
  requested: number;
  backlog_prev: number;
  stock: number;
  need: number;
}

export interface ReportCustomRow extends FrozenUnitName {
  key: string;
  name: string;
  unit: string;
  requested: number;
  backlog_prev: number;
  stock: null;
  need: number;
  people: number;
}

export interface ReportDetailLine extends FrozenUnitName {
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

export interface ReportIssue extends FrozenUnitName {
  item_name: string;
  item_name_en: string | null;
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

export interface ReportSigners {
  preparer: string;
  head: string;
  approver: string;
}

// Bản chốt trước 0112 chỉ có signers; bản mới chỉ có signature_boxes
export interface SnapshotData extends MonthReport {
  order_qty: Record<string, number>;
  signature_boxes?: SignatureBox[];
  signers?: ReportSigners;
  created_by: { sub: string; name: string | null };
  created_at: string;
}
