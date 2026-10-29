import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Res,
  StreamableFile,
} from '@nestjs/common';
import type { Response } from 'express';
import { ClockService } from '../../common/clock.service';
import { YmPipe } from '../../common/ym';
import { CurrentIdentity } from '../auth/current-identity.decorator';
import type { RequestIdentity } from '../auth/identity.types';
import { Roles } from '../auth/roles.decorator';
import { uuidParam } from '../catalog/catalog.dto';
import { ExportQuery, SnapshotBody } from './snapshot.dto';
import { SnapshotsService } from './snapshots.service';
import { buildWorkbook } from './xlsx-report';

const XLSX_TYPE =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

@Controller('admin/reports')
@Roles('admin', 'sa')
export class SnapshotsController {
  constructor(
    private readonly snapshots: SnapshotsService,
    private readonly clock: ClockService,
  ) {}

  @Post(':ym/snapshots')
  create(
    @CurrentIdentity() admin: RequestIdentity,
    @Param('ym', YmPipe) ym: string,
    @Body() body: SnapshotBody,
  ) {
    return this.snapshots.create(ym, body, admin, this.clock.now());
  }

  @Get(':ym/snapshots')
  list(@Param('ym', YmPipe) ym: string) {
    return this.snapshots.list(ym);
  }

  @Get('snapshots/:id')
  get(@Param('id', uuidParam) id: string) {
    return this.snapshots.get(id);
  }

  @Get('snapshots/:id/export.xlsx')
  async exportXlsx(
    @Param('id', uuidParam) id: string,
    @Query() query: ExportQuery,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const snapshot = await this.snapshots.get(id);
    const file = await buildWorkbook(snapshot, query.lang);
    res.set({
      'Content-Type': XLSX_TYPE,
      'Content-Disposition': `attachment; filename="vpp-bao-cao-${snapshot.period_ym}.xlsx"`,
    });
    return new StreamableFile(file);
  }
}
