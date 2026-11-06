import { Module } from '@nestjs/common';
import { PeriodsModule } from '../periods/periods.module';
import { ConfigAdminService } from './config-admin.service';
import { SystemConfigModule } from './config.module';
import { ConfigController } from './config.controller';

// Tách khỏi SystemConfigModule: sửa cấu hình cần kỳ đang mở, còn PeriodsModule lại cần SystemConfigModule
@Module({
  imports: [SystemConfigModule, PeriodsModule],
  controllers: [ConfigController],
  providers: [ConfigAdminService],
})
export class ConfigAdminModule {}
