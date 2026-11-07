import { Controller, Get, Param, Query } from '@nestjs/common';
import { ClockService } from '../../common/clock.service';
import { YmPipe } from '../../common/ym';
import { Roles } from '../auth/roles.decorator';
import { uuidParam } from '../catalog/catalog.dto';
import { PeriodsService } from '../periods/periods.service';
import { RegistrationsService } from './registrations.service';
import { SummaryListsService } from './summary-lists.service';
import { PeriodRequestsQuery } from './summary.dto';
import { SummaryService } from './summary.service';

@Controller('admin')
@Roles('admin', 'sa')
export class AdminSummaryController {
  constructor(
    private readonly summary: SummaryService,
    private readonly lists: SummaryListsService,
    private readonly registrations: RegistrationsService,
    private readonly periods: PeriodsService,
    private readonly clock: ClockService,
  ) {}

  @Get('periods/:ym/summary')
  periodSummary(@Param('ym', YmPipe) ym: string) {
    return this.summary.summary(ym);
  }

  @Get('periods/:ym/requests')
  async requests(
    @Param('ym', YmPipe) ym: string,
    @Query() query: PeriodRequestsQuery,
  ) {
    await this.periods.assertLocked(ym, this.clock.now());
    return query.by === 'item'
      ? this.lists.byItem(ym)
      : this.lists.byPerson(ym, query);
  }

  @Get('periods/:ym/unregistered')
  unregistered(@Param('ym', YmPipe) ym: string) {
    return this.summary.unregistered(ym);
  }

  @Get('periods/:ym/registrations')
  registrationList(@Param('ym', YmPipe) ym: string) {
    return this.registrations.list(ym);
  }

  @Get('periods/:ym/registrations/:id')
  registration(
    @Param('ym', YmPipe) ym: string,
    @Param('id', uuidParam) id: string,
  ) {
    return this.registrations.one(ym, id);
  }

  @Get('requests/:id')
  request(@Param('id', uuidParam) id: string) {
    return this.summary.request(id);
  }
}
