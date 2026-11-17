import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ClockService } from '../../common/clock.service';
import { CurrentIdentity } from '../auth/current-identity.decorator';
import type { RequestIdentity } from '../auth/identity.types';
import { Roles } from '../auth/roles.decorator';
import { uuidParam } from './catalog.dto';
import { YmPipe } from '../../common/ym';
import { PageQuery } from '../../common/page.query';
import {
  IssueDto,
  ReceiptBody,
  StockChangeDto,
  StockLedgerQuery,
} from './stock.dto';
import { StockReceiptService } from './stock-receipt.service';
import { StockQueryService } from './stock-query.service';
import { StockService } from './stock.service';

@Controller()
export class StockController {
  constructor(
    private readonly stock: StockService,
    private readonly query: StockQueryService,
    private readonly receipts: StockReceiptService,
    private readonly clock: ClockService,
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

  @Post('admin/stock/receipts')
  @HttpCode(200)
  @Roles('admin', 'sa')
  receive(
    @Body() body: ReceiptBody,
    @CurrentIdentity() identity: RequestIdentity,
  ) {
    return this.receipts.receive(body, identity.sub);
  }

  @Get('admin/items/:id/movements')
  @Roles('admin', 'sa')
  movements(@Param('id', uuidParam) id: string, @Query() page: PageQuery) {
    return this.query.movements(id, page.limit, page.cursor);
  }

  @Get('admin/stock/movements')
  @Roles('admin', 'sa')
  ledger(@Query() query: StockLedgerQuery) {
    return this.query.ledger(query.ym, query.kind, query.limit, query.cursor);
  }

  @Get('admin/issues')
  @Roles('admin', 'sa')
  issues(@Query('ym', YmPipe) ym: string) {
    return this.query.issuesInMonth(ym);
  }

  @Get('admin/stock')
  @Roles('admin', 'sa')
  list() {
    return this.query.list(this.clock.now());
  }

  @Get('admin/stock/low')
  @Roles('admin', 'sa')
  low() {
    return this.query.lowStock(this.clock.now());
  }

  @Get('me/issues')
  @Roles('member')
  myIssues(
    @Query() page: PageQuery,
    @CurrentIdentity() identity: RequestIdentity,
  ) {
    return this.query.myIssues(identity.sub, page.limit, page.cursor);
  }
}
