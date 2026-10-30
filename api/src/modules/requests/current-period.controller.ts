import { Controller, Get } from '@nestjs/common';
import { CurrentIdentity } from '../auth/current-identity.decorator';
import type { RequestIdentity } from '../auth/identity.types';
import { CurrentPeriodService } from './current-period.service';

@Controller('periods')
export class CurrentPeriodController {
  constructor(private readonly service: CurrentPeriodService) {}

  @Get('current')
  current(@CurrentIdentity() identity: RequestIdentity) {
    return this.service.get(identity.sub, identity.role);
  }
}
