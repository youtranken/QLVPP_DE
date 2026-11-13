import { Controller, Get, Query } from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT } from '../../common/cursor';
import { Roles } from '../auth/roles.decorator';
import {
  USER_LIST_STATUSES,
  UsersService,
  type UserListStatus,
} from './users.service';

class ListUsersQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_LIMIT)
  limit = DEFAULT_PAGE_LIMIT;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  cursor?: string;

  // Mặc định (và all) = mọi người trừ đã xóa; còn lại chỉ trả đúng trạng thái đó (ô Trạng thái ở trang Người dùng)
  @IsOptional()
  @IsIn(USER_LIST_STATUSES)
  status?: UserListStatus;
}

@Controller('admin/users')
@Roles('sa', 'admin')
export class UsersAdminController {
  constructor(private readonly users: UsersService) {}

  @Get()
  list(@Query() query: ListUsersQueryDto) {
    return this.users.list({
      search: query.search,
      limit: query.limit,
      cursor: query.cursor,
      status: query.status,
    });
  }
}
