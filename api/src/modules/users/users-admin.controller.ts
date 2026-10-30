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
import { SystemConfigService } from '../config/system-config.service';
import { Roles } from '../auth/roles.decorator';
import { UsersService } from './users.service';

class ListUsersQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @IsOptional()
  @IsIn(['true', 'false'])
  exclude_admin?: 'true' | 'false';

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
}

@Controller('admin/users')
@Roles('sa', 'admin')
export class UsersAdminController {
  constructor(
    private readonly users: UsersService,
    private readonly config: SystemConfigService,
  ) {}

  @Get()
  async list(@Query() query: ListUsersQueryDto) {
    return this.users.list({
      search: query.search,
      excludeAdminGroup:
        query.exclude_admin === 'true'
          ? await this.config.getAdminGroup()
          : undefined,
      limit: query.limit,
      cursor: query.cursor,
    });
  }
}
