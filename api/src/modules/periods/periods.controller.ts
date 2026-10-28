import { Controller, Get } from '@nestjs/common';
import { CurrentIdentity } from '../auth/current-identity.decorator';
import type { RequestIdentity } from '../auth/identity.types';
import { PeriodsService } from './periods.service';

@Controller('periods')
export class PeriodsController {
  constructor(private readonly periods: PeriodsService) {}

  @Get('current')
  current(@CurrentIdentity() identity: RequestIdentity) {
    return this.periods.current(identity.sub);
  }
}
