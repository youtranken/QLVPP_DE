import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthModule } from './auth/auth.module';
import { DbModule } from './infra/db/db.module';
import { AuditModule } from './modules/audit/audit.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { DirectoryModule } from './modules/directory/directory.module';
import { HealthModule } from './modules/health/health.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { ReportsModule } from './modules/reports/reports.module';
import { RequestsModule } from './modules/requests/requests.module';
import { SettingsModule } from './modules/settings/settings.module';
import { UploadsModule } from './modules/uploads/uploads.module';

/** Module ứng dụng HTTP — modular monolith, mỗi miền nghiệp vụ một module (ADR-0001). */
@Module({
  imports: [
    // Jobs chạy in-process, không Redis/worker riêng (ADR-0008).
    ScheduleModule.forRoot(),
    DbModule,
    SettingsModule,
    AuthModule,
    CatalogModule,
    DirectoryModule,
    RequestsModule,
    NotificationsModule,
    AuditModule,
    UploadsModule,
    ReportsModule,
    HealthModule,
  ],
})
export class AppModule {}
