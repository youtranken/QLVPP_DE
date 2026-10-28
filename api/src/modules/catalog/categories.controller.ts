import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentIdentity } from '../auth/current-identity.decorator';
import type { RequestIdentity } from '../auth/identity.types';
import { Roles } from '../auth/roles.decorator';
import {
  CreateCategoryDto,
  ListCategoriesQuery,
  UpdateCategoryDto,
  uuidParam,
} from './catalog.dto';
import { CategoriesService } from './categories.service';

@Controller()
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Get('item-categories')
  list(
    @Query() query: ListCategoriesQuery,
    @CurrentIdentity() identity: RequestIdentity,
  ) {
    const privileged = identity.role === 'admin' || identity.role === 'sa';
    return this.categories.list(privileged && query.all !== undefined);
  }

  @Post('admin/item-categories')
  @Roles('admin', 'sa')
  create(
    @Body() dto: CreateCategoryDto,
    @CurrentIdentity() identity: RequestIdentity,
  ) {
    return this.categories.create(dto, identity.sub);
  }

  @Patch('admin/item-categories/:id')
  @Roles('admin', 'sa')
  update(
    @Param('id', uuidParam) id: string,
    @Body() dto: UpdateCategoryDto,
    @CurrentIdentity() identity: RequestIdentity,
  ) {
    return this.categories.update(id, dto, identity.sub);
  }
}
