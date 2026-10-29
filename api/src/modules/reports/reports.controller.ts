import { Controller, Get, Param } from '@nestjs/common';
import { ClockService } from '../../common/clock.service';
import { YmPipe } from '../../common/ym';
import { Roles } from '../auth/roles.decorator';
import { ReportsService } from './reports.service';

@Controller('admin/reports')
@Roles('admin', 'sa')
export class ReportsController {
  constructor(
    private readonly reports: ReportsService,
    private readonly clock: ClockService,
  ) {}

  @Get(':ym')
  report(@Param('ym', YmPipe) ym: string) {
    return this.reports.build(ym, this.clock.now());
  }
}
