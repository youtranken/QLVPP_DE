import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PeriodsModule } from '../periods/periods.module';
import { RequestsModule } from '../requests/requests.module';
import { BacklogController } from './backlog.controller';
import { BacklogService } from './backlog.service';
import { BulkDeliveryService } from './bulk-delivery.service';
import { CancelRemainingService } from './cancel-remaining.service';
import { DeliveryController } from './delivery.controller';
import { DeliveryPeopleController } from './delivery-people.controller';
import { DeliveryPeopleService } from './delivery-people.service';
import { DeliveryService } from './delivery.service';

@Module({
  imports: [RequestsModule, CatalogModule, PeriodsModule, NotificationsModule],
  controllers: [
    DeliveryController,
    BacklogController,
    DeliveryPeopleController,
  ],
  providers: [
    DeliveryService,
    BulkDeliveryService,
    CancelRemainingService,
    BacklogService,
    DeliveryPeopleService,
  ],
  exports: [DeliveryService],
})
export class DeliveryModule {}
