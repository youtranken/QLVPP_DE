import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import { PeriodsModule } from '../periods/periods.module';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  imports: [CatalogModule, PeriodsModule],
  controllers: [ReportsController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}
