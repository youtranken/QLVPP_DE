import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { CurrentIdentity } from '../auth/current-identity.decorator';
import type { RequestIdentity } from '../auth/identity.types';
import { Roles } from '../auth/roles.decorator';
import { uuidParam } from './catalog.dto';
import { IssueDto, IssuesQuery, PageQuery, StockChangeDto } from './stock.dto';
import { StockQueryService } from './stock-query.service';
import { StockService } from './stock.service';

@Controller()
export class StockController {
  constructor(
    private readonly stock: StockService,
    private readonly query: StockQueryService,
  ) {}

  @Post('admin/items/:id/stock')
  @Roles('admin', 'sa')
  change(
    @Param('id', uuidParam) id: string,
    @Body() dto: StockChangeDto,
    @CurrentIdentity() identity: RequestIdentity,
  ) {
    return this.stock.change(id, dto, identity.sub);
  }

  @Post('admin/items/:id/issue')
  @Roles('admin', 'sa')
  issue(
    @Param('id', uuidParam) id: string,
    @Body() dto: IssueDto,
    @CurrentIdentity() identity: RequestIdentity,
  ) {
    return this.stock.issue(id, dto, identity.sub);
  }

  @Get('admin/items/:id/movements')
  @Roles('admin', 'sa')
  movements(@Param('id', uuidParam) id: string, @Query() page: PageQuery) {
    return this.query.movements(id, page.limit, page.cursor);
  }

  @Get('admin/issues')
  @Roles('admin', 'sa')
  issues(@Query() q: IssuesQuery) {
    return this.query.issuesInMonth(q.ym);
  }

  @Get('admin/stock/low')
  @Roles('admin', 'sa')
  low() {
    return this.query.lowStock();
  }

  @Get('me/issues')
  myIssues(
    @Query() page: PageQuery,
    @CurrentIdentity() identity: RequestIdentity,
  ) {
    return this.query.myIssues(identity.sub, page.limit, page.cursor);
  }
}
