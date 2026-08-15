import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { CatalogImportController } from './catalog-import.controller';
import { CatalogImportService } from './catalog-import.service';
import { AdminCatalogController, CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';

@Module({
  imports: [AuditModule],
  controllers: [CatalogController, AdminCatalogController, CatalogImportController],
  providers: [CatalogService, CatalogImportService],
  exports: [CatalogService],
})
export class CatalogModule {}
