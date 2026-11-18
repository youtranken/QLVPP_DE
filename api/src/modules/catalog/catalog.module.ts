import { Module, OnModuleInit } from '@nestjs/common';
import { SystemConfigModule } from '../config/config.module';
import { FileAccessPolicy } from '../files/file-access.policy';
import { FilesModule } from '../files/files.module';
import { PeriodsModule } from '../periods/periods.module';
import { UndoModule } from '../undo/undo.module';
import { UnitsModule } from '../units/units.module';
import { UsersModule } from '../users/users.module';
import { AdmOutController } from './adm-out.controller';
import { AdmOutService } from './adm-out.service';
import { ArrivalsPlanService } from './arrivals-plan.service';
import { CatalogService } from './catalog.service';
import { CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';
import { CustomReceiptsService } from './custom-receipts.service';
import { ITEM_IMAGE_REFERENCE } from './item-image.reference';
import { ITEM_USAGE_HOOK, ItemUsageRegistry } from './item-usage.hook';
import { ItemUndoController } from './item-undo.controller';
import { ItemUndoService } from './item-undo.service';
import { ItemsAdminController } from './items-admin.controller';
import { ItemsController } from './items.controller';
import { StockController } from './stock.controller';
import { StockQueryService } from './stock-query.service';
import { StockReceiptService } from './stock-receipt.service';
import { StockService } from './stock.service';

@Module({
  imports: [
    FilesModule,
    UsersModule,
    SystemConfigModule,
    UnitsModule,
    PeriodsModule,
    UndoModule,
  ],
  controllers: [
    CategoriesController,
    ItemsController,
    ItemsAdminController,
    StockController,
    AdmOutController,
    ItemUndoController,
  ],
  providers: [
    CatalogService,
    CategoriesService,
    StockService,
    StockReceiptService,
    StockQueryService,
    ArrivalsPlanService,
    AdmOutService,
    CustomReceiptsService,
    ItemUndoService,
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
