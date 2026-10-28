import { Controller, Get, Param, Query } from '@nestjs/common';
import { YmPipe } from '../../common/ym';
import { Roles } from '../auth/roles.decorator';
import { uuidParam } from '../catalog/catalog.dto';
import { SummaryListsService } from './summary-lists.service';
import { PeriodRequestsQuery } from './summary.dto';
import { SummaryService } from './summary.service';

@Controller('admin')
@Roles('admin', 'sa')
export class AdminSummaryController {
  constructor(
    private readonly summary: SummaryService,
    private readonly lists: SummaryListsService,
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
    await this.summary.assertViewable(ym);
    return query.by === 'item'
      ? this.lists.byItem(ym)
      : this.lists.byPerson(ym, query);
  }

  @Get('periods/:ym/unregistered')
  unregistered(@Param('ym', YmPipe) ym: string) {
    return this.summary.unregistered(ym);
  }

  @Get('requests/:id')
  request(@Param('id', uuidParam) id: string) {
    return this.summary.request(id);
  }
}
