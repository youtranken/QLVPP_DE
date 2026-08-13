import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { DbModule } from './infra/db/db.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { HealthModule } from './modules/health/health.module';

/** Module ứng dụng HTTP. Feature module nghiệp vụ (requests, notifications…) thêm ở M2. */
@Module({ imports: [DbModule, AuthModule, CatalogModule, HealthModule] })
export class AppModule {}
