import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
} from '@nestjs/common';
import { ClockService } from '../../common/clock.service';
import { YmPipe } from '../../common/ym';
import { CurrentIdentity } from '../auth/current-identity.decorator';
import type { RequestIdentity } from '../auth/identity.types';
import { Roles } from '../auth/roles.decorator';
import { SendStateService } from './send-state.service';
import { NoOrderBody } from './snapshot.dto';

@Controller('admin/periods')
@Roles('admin', 'sa')
export class NoOrderController {
  constructor(
    private readonly sendState: SendStateService,
    private readonly clock: ClockService,
  ) {}

  @Get(':ym/send-state')
  state(@Param('ym', YmPipe) ym: string) {
    return this.sendState.state(ym, this.clock.now());
  }

  @Post(':ym/no-order')
  @HttpCode(200)
  markNoOrder(
    @CurrentIdentity() admin: RequestIdentity,
    @Param('ym', YmPipe) ym: string,
    @Body() body: NoOrderBody,
  ) {
    return this.sendState.markNoOrder(ym, body, admin, this.clock.now());
  }

  @Delete(':ym/no-order')
  @HttpCode(204)
  async clearNoOrder(
    @CurrentIdentity() admin: RequestIdentity,
    @Param('ym', YmPipe) ym: string,
  ): Promise<void> {
    await this.sendState.clearNoOrder(ym, admin, this.clock.now());
  }
}
