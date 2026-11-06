import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ClockService } from '../../common/clock.service';
import { DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT } from '../../common/cursor';
import { DATE_FROM_2000 } from '../../common/ym';
import { CurrentIdentity } from '../auth/current-identity.decorator';
import type { RequestIdentity } from '../auth/identity.types';
import { Roles } from '../auth/roles.decorator';
import { PeriodsService } from '../periods/periods.service';
import { AuditQueryService } from './audit-query.service';

function invalid(field: string, message: string): BadRequestException {
  return new BadRequestException({
    code: 'VALIDATION',
    message,
    fields: [field],
  });
}

// Regex chỉ chặn định dạng; còn phải là ngày lịch thật (2026-02-30 bị loại)
function assertValidDate(field: string, s: string): void {
  const d = new Date(`${s}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s) {
    throw invalid(field, `Ngày không hợp lệ: ${s}`);
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
  @Matches(DATE_FROM_2000, { message: 'from phải dạng YYYY-MM-DD, năm ≥ 2000' })
  from?: string;

  @IsOptional()
  @Matches(DATE_FROM_2000, { message: 'to phải dạng YYYY-MM-DD, năm ≥ 2000' })
  to?: string;

  @IsOptional()
  @IsIn(['true', 'false'])
  self?: 'true' | 'false';

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
  constructor(
    private readonly audit: AuditQueryService,
    private readonly periods: PeriodsService,
    private readonly clock: ClockService,
  ) {}

  @Get()
  async list(
    @Query() q: AuditQueryDto,
    @CurrentIdentity() identity: RequestIdentity,
  ) {
    if (q.from) assertValidDate('from', q.from);
    if (q.to) assertValidDate('to', q.to);
    if (q.from && q.to && q.to < q.from) {
      throw invalid('to', 'to phải ≥ from');
    }
    return this.audit.listAudit({
      actor: q.actor,
      action: q.action,
      from: q.from,
      to: q.to,
      self: q.self === undefined ? undefined : q.self === 'true',
      limit: q.limit,
      cursor: q.cursor,
      // SA thấy hết; Hành chính không thấy thao tác trên phiếu kỳ còn mở
      lockedBefore:
        identity.role === 'sa'
          ? undefined
          : (await this.periods.openPeriod(undefined, this.clock.now())).ym,
    });
  }
}
