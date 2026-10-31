import {
  Body,
  Controller,
  Delete,
  HttpCode,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { CurrentIdentity } from '../auth/current-identity.decorator';
import type { RequestIdentity } from '../auth/identity.types';
import { Roles } from '../auth/roles.decorator';
import { CreateUnitDto, UpdateUnitDto } from './units.dto';
import { UnitsService } from './units.service';

@Controller('admin/units')
@Roles('admin', 'sa')
export class UnitsAdminController {
  constructor(private readonly units: UnitsService) {}

  @Post()
  create(
    @Body() dto: CreateUnitDto,
    @CurrentIdentity() identity: RequestIdentity,
  ) {
    return this.units.create(dto, identity.sub);
  }

  @Patch(':code')
  update(
    @Param('code') code: string,
    @Body() dto: UpdateUnitDto,
    @CurrentIdentity() identity: RequestIdentity,
  ) {
    return this.units.update(code, dto, identity.sub);
  }

  @Delete(':code')
  @HttpCode(204)
  async remove(
    @Param('code') code: string,
    @CurrentIdentity() identity: RequestIdentity,
  ): Promise<void> {
    await this.units.remove(code, identity.sub);
  }
}
