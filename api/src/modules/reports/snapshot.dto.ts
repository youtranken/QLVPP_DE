import {
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  Min,
} from 'class-validator';
import type { XlsxLang } from './xlsx-labels';

// Ô Đề nghị người dùng gõ; số mặc định hệ thống tính ra vượt trần vẫn giữ nguyên (không kẹp ngầm)
export const ORDER_QTY_MAX = 1000;

// Chốt kỳ ghi Không mua cho món ngoài danh mục còn chờ: client xác nhận đúng số món đang thấy
class PendingCustomConfirm {
  @IsOptional() @IsBoolean() reject_pending_custom?: boolean;
  @IsOptional() @IsInt() @Min(0) expected_pending?: number;
}

export class SnapshotBody extends PendingCustomConfirm {
  @IsIn(['xlsx', 'print']) kind!: 'xlsx' | 'print';

  // Khóa động theo hàng báo cáo → kiểm từng ô ở service khi đã có báo cáo
  @IsOptional() @IsObject() order_qty?: Record<string, unknown>;

  @IsOptional() @IsBoolean() reuse_if_unchanged?: boolean;
}

// Xem trước bản in: cùng ô Đề nghị như lúc tạo bản, không có kind/reuse vì không lưu gì
export class PreviewBody {
  @IsOptional() @IsObject() order_qty?: Record<string, unknown>;
}

export class NoOrderBody extends PendingCustomConfirm {
  @IsOptional() @IsObject() order_qty?: Record<string, unknown>;
}

export class ExportQuery {
  @IsOptional() @IsIn(['vi', 'en']) lang: XlsxLang = 'vi';
}
