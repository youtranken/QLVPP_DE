import { Module } from '@nestjs/common';
import { SystemConfigModule } from '../config/config.module';
import { PeriodsService } from './periods.service';

@Module({
  imports: [SystemConfigModule],
  providers: [PeriodsService],
  exports: [PeriodsService],
})
export class PeriodsModule {}
