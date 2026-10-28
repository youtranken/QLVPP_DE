import { Module } from '@nestjs/common';
import { ConfigAdminService } from './config-admin.service';
import { ConfigController } from './config.controller';
import { PublicConfigController } from './public-config.controller';
import { SystemConfigService } from './system-config.service';

@Module({
  controllers: [ConfigController, PublicConfigController],
  providers: [SystemConfigService, ConfigAdminService],
  exports: [SystemConfigService],
})
export class SystemConfigModule {}
