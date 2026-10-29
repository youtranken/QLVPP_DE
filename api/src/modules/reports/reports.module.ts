import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import { SystemConfigModule } from '../config/config.module';
import { PeriodsModule } from '../periods/periods.module';
import { UsersModule } from '../users/users.module';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { SnapshotsController } from './snapshots.controller';
import { SnapshotsService } from './snapshots.service';

@Module({
  imports: [CatalogModule, PeriodsModule, SystemConfigModule, UsersModule],
  controllers: [ReportsController, SnapshotsController],
  providers: [ReportsService, SnapshotsService],
  exports: [ReportsService],
})
export class ReportsModule {}
