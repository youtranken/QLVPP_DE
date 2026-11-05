import { Module, OnModuleInit } from '@nestjs/common';
import { SystemConfigModule } from '../config/config.module';
import { FileAccessPolicy } from '../files/file-access.policy';
import { FilesModule } from '../files/files.module';
import { UnitsModule } from '../units/units.module';
import { UsersModule } from '../users/users.module';
import { CatalogService } from './catalog.service';
import { CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';
import { ITEM_IMAGE_REFERENCE } from './item-image.reference';
import { ITEM_USAGE_HOOK, ItemUsageRegistry } from './item-usage.hook';
import { ItemsAdminController } from './items-admin.controller';
import { ItemsController } from './items.controller';
import { StockController } from './stock.controller';
import { StockQueryService } from './stock-query.service';
import { StockReceiptService } from './stock-receipt.service';
import { StockService } from './stock.service';

@Module({
  imports: [FilesModule, UsersModule, SystemConfigModule, UnitsModule],
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
    StockReceiptService,
    StockQueryService,
    ItemUsageRegistry,
    { provide: ITEM_USAGE_HOOK, useExisting: ItemUsageRegistry },
  ],
  exports: [CatalogService, StockService, StockQueryService, ItemUsageRegistry],
})
export class CatalogModule implements OnModuleInit {
  constructor(private readonly filePolicy: FileAccessPolicy) {}

  onModuleInit(): void {
    this.filePolicy.registerReference(ITEM_IMAGE_REFERENCE);
  }
}
