import { IsBoolean, IsIn, IsObject, IsOptional } from 'class-validator';
import type { XlsxLang } from './xlsx-labels';

export const ORDER_QTY_MAX = 99999;

export class SnapshotBody {
  @IsIn(['xlsx', 'print']) kind!: 'xlsx' | 'print';

  // Khóa động theo hàng báo cáo → kiểm từng ô ở service khi đã có báo cáo
  @IsOptional() @IsObject() order_qty?: Record<string, unknown>;

  @IsOptional() @IsBoolean() reuse_if_unchanged?: boolean;
}

export class NoOrderBody {
  @IsOptional() @IsObject() order_qty?: Record<string, unknown>;
}

export class ExportQuery {
  @IsOptional() @IsIn(['vi', 'en']) lang: XlsxLang = 'vi';
}
