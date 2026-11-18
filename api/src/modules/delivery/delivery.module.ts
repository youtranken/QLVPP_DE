import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PeriodsModule } from '../periods/periods.module';
import { RequestsModule } from '../requests/requests.module';
import { UndoModule } from '../undo/undo.module';
import { BacklogController } from './backlog.controller';
import { BacklogService } from './backlog.service';
import { BulkDeliveryService } from './bulk-delivery.service';
import { CancelRemainingService } from './cancel-remaining.service';
import { CancelUndoService } from './cancel-undo.service';
import { DeliveryController } from './delivery.controller';
import { DeliveryPeopleController } from './delivery-people.controller';
import { DeliveryPeopleService } from './delivery-people.service';
import { DeliveryService } from './delivery.service';
import { DeliveryUndoService } from './delivery-undo.service';

@Module({
  imports: [
    RequestsModule,
    CatalogModule,
    PeriodsModule,
    NotificationsModule,
    UndoModule,
  ],
  controllers: [
    DeliveryController,
    BacklogController,
    DeliveryPeopleController,
  ],
  providers: [
    DeliveryService,
    BulkDeliveryService,
    CancelRemainingService,
    DeliveryUndoService,
    CancelUndoService,
    BacklogService,
    DeliveryPeopleService,
  ],
  exports: [DeliveryService],
})
export class DeliveryModule {}
