import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { ClockService } from '../../common/clock.service';
import { YmPipe } from '../../common/ym';
import { CurrentIdentity } from '../auth/current-identity.decorator';
import type { RequestIdentity } from '../auth/identity.types';
import { Roles } from '../auth/roles.decorator';
import { AdmOutService } from './adm-out.service';
import { ArrivalsPlanService } from './arrivals-plan.service';
import { CustomReceiptsService } from './custom-receipts.service';
import { LineKeyPipe } from './line-key';
import type { LineKey } from './line-key';
import { CustomReceiptBody } from './stock.dto';

// Hàng về theo kỳ: kế hoạch, ADM hết hàng, ADM không giao nữa, hàng ngoài danh mục đã về
@Controller('admin/periods')
@Roles('admin', 'sa')
export class AdmOutController {
  constructor(
    private readonly plans: ArrivalsPlanService,
    private readonly admOut: AdmOutService,
    private readonly customReceipts: CustomReceiptsService,
    private readonly clock: ClockService,
  ) {}

  @Get(':ym/arrivals-plan')
  plan(@Param('ym', YmPipe) ym: string) {
    return this.plans.plan(ym, this.clock.now());
  }

  @Put(':ym/adm-out/:line_key')
  mark(
    @Param('ym', YmPipe) ym: string,
    @Param('line_key', LineKeyPipe) key: LineKey,
    @CurrentIdentity() admin: RequestIdentity,
  ) {
    return this.admOut.mark(ym, key, admin.sub, this.clock.now());
  }

  @Delete(':ym/adm-out/:line_key')
  @HttpCode(204)
  async unmark(
    @Param('ym', YmPipe) ym: string,
    @Param('line_key', LineKeyPipe) key: LineKey,
    @CurrentIdentity() admin: RequestIdentity,
  ): Promise<void> {
    await this.admOut.unmark(ym, key, admin.sub, this.clock.now());
  }

  @Put(':ym/adm-owed-closed/:line_key')
  closeOwed(
    @Param('ym', YmPipe) ym: string,
    @Param('line_key', LineKeyPipe) key: LineKey,
    @CurrentIdentity() admin: RequestIdentity,
  ) {
    return this.admOut.closeOwed(ym, key, admin.sub, this.clock.now());
  }

  @Delete(':ym/adm-owed-closed/:line_key')
  @HttpCode(204)
  async reopenOwed(
    @Param('ym', YmPipe) ym: string,
    @Param('line_key', LineKeyPipe) key: LineKey,
    @CurrentIdentity() admin: RequestIdentity,
  ): Promise<void> {
    await this.admOut.reopenOwed(ym, key, admin.sub, this.clock.now());
  }

  @Post(':ym/custom-receipts')
  receiveCustom(
    @Param('ym', YmPipe) ym: string,
    @Body() body: CustomReceiptBody,
    @CurrentIdentity() admin: RequestIdentity,
  ) {
    return this.customReceipts.receive(ym, body, admin.sub, this.clock.now());
  }
}
