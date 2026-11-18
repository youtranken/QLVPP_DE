import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ClockService } from '../../common/clock.service';
import { DRIZZLE_DB } from '../../database/database.module';
import type { Database } from '../../database/database.module';
import { CurrentIdentity } from '../auth/current-identity.decorator';
import type { RequestIdentity } from '../auth/identity.types';
import { Roles } from '../auth/roles.decorator';
import { CreateItemDto, UpdateItemDto, uuidParam } from './catalog.dto';
import { PeriodsService } from '../periods/periods.service';
import { CatalogService } from './catalog.service';
import { pendingArrival } from './pending-arrival';

@Controller('admin/items')
@Roles('admin', 'sa')
export class ItemsAdminController {
  constructor(
    private readonly catalog: CatalogService,
    @Inject(DRIZZLE_DB) private readonly db: Database,
    private readonly periods: PeriodsService,
    private readonly clock: ClockService,
  ) {}

  @Get()
  list(@CurrentIdentity() identity: RequestIdentity) {
    return this.catalog.listFor(identity);
  }

  @Post()
  create(
    @Body() dto: CreateItemDto,
    @CurrentIdentity() identity: RequestIdentity,
  ) {
    return this.catalog.create(dto, identity.sub);
  }

  @Get(':id/pending-arrival')
  async pendingArrival(@Param('id', uuidParam) id: string) {
    const { openYm, kStar } = await this.periods.stockPeriods(this.clock.now());
    return pendingArrival(this.db, id, openYm, kStar);
  }

  @Patch(':id')
  update(
    @Param('id', uuidParam) id: string,
    @Body() dto: UpdateItemDto,
    @CurrentIdentity() identity: RequestIdentity,
  ) {
    return this.catalog.update(id, dto, identity.sub);
  }

  // 200 kèm undo_id (hoàn tác 5 giây) thay cho 204 không thân
  @Delete(':id')
  @HttpCode(200)
  remove(
    @Param('id', uuidParam) id: string,
    @CurrentIdentity() identity: RequestIdentity,
  ): Promise<{ undo_id: string }> {
    return this.catalog.remove(id, identity.sub);
  }
}
