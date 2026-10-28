import { Module } from '@nestjs/common';
import { SystemConfigModule } from '../config/config.module';
import { PeriodsController } from './periods.controller';
import { PeriodsService } from './periods.service';

@Module({
  imports: [SystemConfigModule],
  controllers: [PeriodsController],
  providers: [PeriodsService],
  exports: [PeriodsService],
})
export class PeriodsModule {}
