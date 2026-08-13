import { Module } from '@nestjs/common';
import { HealthModule } from './modules/health/health.module';

/** Module ứng dụng HTTP. Feature module (auth, catalog, requests…) sẽ thêm ở M1/M2. */
@Module({ imports: [HealthModule] })
export class AppModule {}
