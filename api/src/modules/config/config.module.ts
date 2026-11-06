import { Module } from '@nestjs/common';
import { PublicConfigController } from './public-config.controller';
import { SystemConfigService } from './system-config.service';

@Module({
  controllers: [PublicConfigController],
  providers: [SystemConfigService],
  exports: [SystemConfigService],
})
export class SystemConfigModule {}
