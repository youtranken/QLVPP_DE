import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { CurrentIdentity } from '../auth/current-identity.decorator';
import type { RequestIdentity } from '../auth/identity.types';
import { Roles } from '../auth/roles.decorator';
import { CreateItemDto, UpdateItemDto, uuidParam } from './catalog.dto';
import { CatalogService } from './catalog.service';

@Controller('admin/items')
@Roles('admin', 'sa')
export class ItemsAdminController {
  constructor(private readonly catalog: CatalogService) {}

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

  @Patch(':id')
  update(
    @Param('id', uuidParam) id: string,
    @Body() dto: UpdateItemDto,
    @CurrentIdentity() identity: RequestIdentity,
  ) {
    return this.catalog.update(id, dto, identity.sub);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(
    @Param('id', uuidParam) id: string,
    @CurrentIdentity() identity: RequestIdentity,
  ): Promise<void> {
    await this.catalog.remove(id, identity.sub);
  }
}
