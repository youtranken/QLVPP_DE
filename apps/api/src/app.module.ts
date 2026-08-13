import { Module } from '@nestjs/common';
import { DbModule } from './infra/db/db.module';
import { HealthModule } from './modules/health/health.module';

/** Module ứng dụng HTTP. Feature module nghiệp vụ (requests, notifications…) thêm ở M2. */
@Module({ imports: [DbModule, HealthModule] })
export class AppModule {}
