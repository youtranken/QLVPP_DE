import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import type { CancelledLine } from '../requests/line-delivery.store';

// Thân thô (NFD, khoảng trắng) dài hơn số ký tự đếm được nhiều lần; luật 200 nằm ở cancelNoteOf
const REASON_RAW_MAX = 1000;

export const DELIVER_QTY_MAX = 9999;

export class DeliverBody {
  @IsInt() @Min(1) @Max(DELIVER_QTY_MAX) qty!: number;
  @IsInt() @Min(0) expected_delivered_qty!: number;
}

export const CANCEL_REASONS = [
  'adm_out_of_stock',
  'not_needed',
  'user_left',
  'other',
] as const;
export type CancelReason = (typeof CANCEL_REASONS)[number];

// Thiếu mã / "Khác" thiếu ghi chú là REASON_REQUIRED (luật ở service), không phải VALIDATION
export class CancelBody {
  @IsOptional() @IsIn(CANCEL_REASONS) reason_code?: CancelReason;
  @IsOptional() @IsString() @MaxLength(REASON_RAW_MAX) reason?: string;
  @IsInt() @Min(0) expected_delivered_qty!: number;
  // qty đổi sau khi mở hộp thì phần hủy khác số hộp đang hiện
  @IsInt() @Min(1) expected_qty!: number;
}

export const BACKLOG_BY = ['item', 'person'] as const;
export type BacklogBy = (typeof BACKLOG_BY)[number];

export class BacklogQuery {
  @IsOptional() @IsIn(BACKLOG_BY) by: BacklogBy = 'item';
}

export interface CancelResult {
  line: CancelledLine;
  cancelled_now: number;
}

export interface BacklogLine {
  line_id: string;
  request_id: string;
  period_ym: string;
  user_sub: string;
  full_name: string | null;
  department: string | null;
  user_status: string;
  item_id: string | null;
  name: string;
  name_en: string | null;
  unit: string;
  qty: number;
  delivered_qty: number;
  cancelled_qty: number;
  remaining_qty: number;
  stock_qty: number | null;
  // Phần nợ đã tính vào bản gửi ADM của kỳ khóa gần nhất; null khi chưa có bản hoặc dòng thuộc chính kỳ đó
  counted_in_snapshot_qty: number | null;
}

export interface BacklogGroup {
  key: string;
  label: {
    item_id?: string | null;
    name?: string;
    unit?: string;
    user_sub?: string;
    full_name?: string | null;
    department?: string | null;
  };
  remaining_qty: number;
  lines: BacklogLine[];
}

export interface LineDeliveries {
  line: CancelledLine;
  items: {
    id: string;
    qty: number;
    movement_id: string | null;
    actor_sub: string;
    actor_name: string | null;
    created_at: string;
  }[];
}

export interface DeliverResult {
  line: {
    id: string;
    qty: number;
    delivered_qty: number;
    cancelled_qty: number;
  };
  movement_id: string | null;
  stock_qty: number | null;
  request_complete: boolean;
}

export interface DeliverAllFailure {
  line_id: string;
  code: string;
  available?: number;
}

export interface DeliverAllResult {
  delivered: { line_id: string; qty: number }[];
  failed: DeliverAllFailure[];
}

export type DeliveryPersonStatus = 'pending' | 'debt' | 'done';
export interface DeliveryPersonLine {
  line_id: string;
  request_id: string;
  period_ym: string;
  is_debt: boolean; // period_ym < tháng đang giao (kỳ khóa mới nhất)
  item_id: string | null;
  name: string;
  name_en: string | null;
  unit: string;
  image_file_id: string | null; // ảnh món; món ngoài DM: ảnh của dòng
  qty: number;
  delivered_qty: number;
  cancelled_qty: number;
  remaining_qty: number;
  stock_qty: number | null;
  review_status: 'n/a' | 'pending' | 'accepted' | 'converted';
  adm_out: boolean; // món/khóa của dòng đánh "ADM hết hàng" cho kỳ của dòng
  custom_tracked: boolean; // dòng ngoài DM có trong bản in: trần theo hàng đã về
  deliver_cap: number | null; // null = món danh mục (trần theo tủ ở web)
  ahead_qty: number; // còn chờ của các dòng cùng món đứng trước (kỳ → lưu phiếu → thêm dòng → id), bỏ người đã nghỉ
  request_at: string; // lần lưu đầu của phiếu (ISO, µs) — thứ tự đăng ký
  line_at: string;
}
export interface DeliveryPerson {
  user_sub: string;
  full_name: string | null;
  department: string | null;
  user_status: string;
  request_id: string | null; // phiếu kỳ ym, null nếu chỉ có nợ
  status: DeliveryPersonStatus;
  owed_lines: number;
  open_lines: number;
  has_pending: boolean;
  has_debt: boolean;
  deliverable_now: boolean; // có dòng giao được ngay từ tủ/hàng đã về theo thứ tự đăng ký
  lines: DeliveryPersonLine[];
}
