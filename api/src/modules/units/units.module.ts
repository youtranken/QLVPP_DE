import { Module } from '@nestjs/common';
import { UnitsAdminController } from './units-admin.controller';
import { UnitsController } from './units.controller';
import { UnitsService } from './units.service';

@Module({
  controllers: [UnitsController, UnitsAdminController],
  providers: [UnitsService],
  exports: [UnitsService],
})
export class UnitsModule {}
