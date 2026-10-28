import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT } from '../../common/cursor';
import { Roles } from '../auth/roles.decorator';
import { AuditQueryService } from './audit-query.service';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Regex chỉ chặn định dạng; còn phải là ngày lịch thật (2026-02-30 bị loại)
function assertValidDate(s: string): void {
  const d = new Date(`${s}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s) {
    throw new BadRequestException(`Ngày không hợp lệ: ${s}`);
  }
}

class AuditQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  actor?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  action?: string;

  @IsOptional()
  @Matches(DATE_RE, { message: 'from phải dạng YYYY-MM-DD' })
  from?: string;

  @IsOptional()
  @Matches(DATE_RE, { message: 'to phải dạng YYYY-MM-DD' })
  to?: string;

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

@Controller('admin/audit')
@Roles('sa', 'admin')
export class AuditController {
  constructor(private readonly audit: AuditQueryService) {}

  @Get()
  list(@Query() q: AuditQueryDto) {
    if (q.from) assertValidDate(q.from);
    if (q.to) assertValidDate(q.to);
    if (q.from && q.to && q.to < q.from) {
      throw new BadRequestException('to phải ≥ from');
    }
    return this.audit.listAudit({
      actor: q.actor,
      action: q.action,
      from: q.from,
      to: q.to,
      limit: q.limit,
      cursor: q.cursor,
    });
  }
}
