import { Module, OnModuleInit } from '@nestjs/common';
import { SystemConfigModule } from '../config/config.module';
import { FileAccessPolicy } from '../files/file-access.policy';
import { FilesModule } from '../files/files.module';
import { UsersModule } from '../users/users.module';
import { CatalogService } from './catalog.service';
import { CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';
import { ITEM_IMAGE_REFERENCE } from './item-image.reference';
import { ITEM_USAGE_HOOK, NoItemUsageHook } from './item-usage.hook';
import { ItemsAdminController } from './items-admin.controller';
import { ItemsController } from './items.controller';
import { StockController } from './stock.controller';
import { StockQueryService } from './stock-query.service';
import { StockService } from './stock.service';

@Module({
  imports: [FilesModule, UsersModule, SystemConfigModule],
  controllers: [
    CategoriesController,
    ItemsController,
    ItemsAdminController,
    StockController,
  ],
  providers: [
    CatalogService,
    CategoriesService,
    StockService,
    StockQueryService,
    { provide: ITEM_USAGE_HOOK, useClass: NoItemUsageHook },
  ],
  exports: [CatalogService, StockService],
})
export class CatalogModule implements OnModuleInit {
  constructor(private readonly filePolicy: FileAccessPolicy) {}

  onModuleInit(): void {
    this.filePolicy.registerReference(ITEM_IMAGE_REFERENCE);
  }
}
