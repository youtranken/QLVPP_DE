import { Controller, ForbiddenException, Get, Query } from '@nestjs/common';
import { CurrentIdentity } from '../auth/current-identity.decorator';
import type { RequestIdentity } from '../auth/identity.types';
import { ListUnitsQuery } from './units.dto';
import { UnitsService } from './units.service';

@Controller('units')
export class UnitsController {
  constructor(private readonly units: UnitsService) {}

  @Get()
  list(
    @Query() query: ListUnitsQuery,
    @CurrentIdentity() identity: RequestIdentity,
  ) {
    if (query.all === undefined) return this.units.listActive();
    if (identity.role !== 'admin' && identity.role !== 'sa') {
      throw new ForbiddenException({
        code: 'FORBIDDEN_ROLE',
        message: 'Chỉ Hành chính xem được ĐVT đã ngừng.',
      });
    }
    return this.units.listAll();
  }
}
