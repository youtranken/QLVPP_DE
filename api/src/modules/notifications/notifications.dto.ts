import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsOptional,
  IsUUID,
  ValidateIf,
} from 'class-validator';
import { PageQuery } from '../../common/page.query';

export const MARK_READ_MAX_IDS = 200;

export class NotificationsQuery extends PageQuery {
  @IsOptional() @IsIn(['true', 'false']) unread?: 'true' | 'false';
}

// Vắng `ids` = đánh dấu tất cả; `null`/`[]` là lỗi để không đọc hết vì nhầm
export class MarkReadBody {
  @ValidateIf((_, v) => v !== undefined)
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MARK_READ_MAX_IDS)
  @IsUUID('all', { each: true })
  ids?: string[];
}
