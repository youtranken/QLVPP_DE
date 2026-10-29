import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PeriodsModule } from '../periods/periods.module';
import { RequestsModule } from '../requests/requests.module';
import { DeliveryController } from './delivery.controller';
import { DeliveryService } from './delivery.service';

@Module({
  imports: [RequestsModule, CatalogModule, PeriodsModule, NotificationsModule],
  controllers: [DeliveryController],
  providers: [DeliveryService],
  exports: [DeliveryService],
})
export class DeliveryModule {}
