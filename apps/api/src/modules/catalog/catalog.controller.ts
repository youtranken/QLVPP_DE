import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import type { AuthenticatedUser } from '../../auth/auth.service';
import { CurrentUser, Roles } from '../../auth/roles.decorator';
import { ZodPipe } from '../../infra/validation/zod.pipe';
import {
  CreateCategorySchema,
  CreateItemSchema,
  UpdateCategorySchema,
  UpdateItemSchema,
  type CreateCategoryDto,
  type CreateItemDto,
  type UpdateCategoryDto,
  type UpdateItemDto,
} from './catalog.dto';
import { CatalogService, type CatalogCategory } from './catalog.service';

/** Danh mục VPP cho mọi người đã đăng nhập — SDD §7. */
@Controller('api/catalog')
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  /**
   * `includeInactive` chỉ có tác dụng với admin (màn quản lý danh mục cần thấy
   * cả món đã ngừng); member gửi tham số này cũng bị bỏ qua.
   */
  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('includeInactive') includeInactive?: string,
  ): Promise<CatalogCategory[]> {
    const wantsAll = includeInactive === '1' || includeInactive === 'true';
    return this.catalog.getCatalog(wantsAll && user.role === 'admin');
  }
}

/** Quản lý danh mục — chỉ admin (SDD §2). */
@Roles('admin')
@Controller('api/admin')
export class AdminCatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Post('categories')
  createCategory(@Body(new ZodPipe(CreateCategorySchema)) dto: CreateCategoryDto) {
    return this.catalog.createCategory(dto);
  }

  @Patch('categories/:id')
  updateCategory(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(UpdateCategorySchema)) dto: UpdateCategoryDto,
  ) {
    return this.catalog.updateCategory(id, dto);
  }

  @Delete('categories/:id')
  @HttpCode(204)
  deleteCategory(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.catalog.deleteCategory(id);
  }

  @Post('items')
  createItem(@Body(new ZodPipe(CreateItemSchema)) dto: CreateItemDto) {
    return this.catalog.createItem(dto);
  }

  @Patch('items/:id')
  updateItem(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(UpdateItemSchema)) dto: UpdateItemDto,
  ) {
    return this.catalog.updateItem(id, dto);
  }

  @Delete('items/:id')
  @HttpCode(204)
  deleteItem(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.catalog.deleteItem(id);
  }
}
