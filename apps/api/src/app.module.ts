import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { DbModule } from './infra/db/db.module';
import { AuditModule } from './modules/audit/audit.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { HealthModule } from './modules/health/health.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { RequestsModule } from './modules/requests/requests.module';

/** Module ứng dụng HTTP — modular monolith, mỗi miền nghiệp vụ một module (ADR-0001). */
@Module({
  imports: [
    DbModule,
    AuthModule,
    CatalogModule,
    RequestsModule,
    NotificationsModule,
    AuditModule,
    HealthModule,
  ],
})
export class AppModule {}
