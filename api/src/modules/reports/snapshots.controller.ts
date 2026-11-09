import {
  Body,
  Controller,
  Get,
  HttpCode,
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
import { UnitsService } from '../units/units.service';
import { ExportQuery, PreviewBody, SnapshotBody } from './snapshot.dto';
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
    private readonly units: UnitsService,
  ) {}

  // 200 khi dùng lại bản cũ, 201 khi tạo bản mới
  @Post(':ym/snapshots')
  async create(
    @CurrentIdentity() admin: RequestIdentity,
    @Param('ym', YmPipe) ym: string,
    @Body() body: SnapshotBody,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.snapshots.create(
      ym,
      body,
      admin,
      this.clock.now(),
    );
    res.status(result.reused ? 200 : 201);
    return result;
  }

  // "Xem tổng kết": bản sẽ in, không lưu; POST vì mang ô Đề nghị đã sửa
  @Post(':ym/snapshots/preview')
  @HttpCode(200)
  preview(
    @CurrentIdentity() admin: RequestIdentity,
    @Param('ym', YmPipe) ym: string,
    @Body() body: PreviewBody,
  ) {
    return this.snapshots.preview(ym, body, admin, this.clock.now());
  }

  @Get(':ym/sent')
  sent(@Param('ym', YmPipe) ym: string) {
    return this.snapshots.sent(ym, this.clock.now());
  }

  @Get(':ym/snapshots')
  list(@Param('ym', YmPipe) ym: string) {
    return this.snapshots.list(ym, this.clock.now());
  }

  @Get('snapshots/:id')
  get(@Param('id', uuidParam) id: string) {
    return this.snapshots.get(id, this.clock.now());
  }

  @Get('snapshots/:id/export.xlsx')
  async exportXlsx(
    @Param('id', uuidParam) id: string,
    @Query() query: ExportQuery,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const snapshot = await this.snapshots.get(id, this.clock.now());
    const file = await buildWorkbook(
      snapshot,
      query.lang,
      await this.units.namesByCode(),
    );
    res.set({
      'Content-Type': XLSX_TYPE,
      'Content-Disposition': `attachment; filename="vpp-bao-cao-${snapshot.period_ym}.xlsx"`,
    });
    return new StreamableFile(file);
  }
}
