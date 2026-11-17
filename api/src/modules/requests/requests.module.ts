import { AdminUserHistoryController } from './admin-user-history.controller';
import { Module, OnModuleInit } from '@nestjs/common';
import { AdminRequestService } from './admin-request.service';
import { AdminRequestsController } from './admin-requests.controller';
import { AdminSummaryController } from './admin-summary.controller';
import { CatalogModule } from '../catalog/catalog.module';
import { ItemUsageRegistry } from '../catalog/item-usage.hook';
import { SystemConfigModule } from '../config/config.module';
import { FileAccessPolicy } from '../files/file-access.policy';
import { FilesModule } from '../files/files.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PeriodsModule } from '../periods/periods.module';
import { UsersModule } from '../users/users.module';
import { CopyPreviousService } from './copy-previous.service';
import { CurrentPeriodController } from './current-period.controller';
import { CurrentPeriodService } from './current-period.service';
import { HistoryService } from './history.service';
import { LineNotifier } from './line-notifier';
import { LineDeliveryStore } from './line-delivery.store';
import { LINE_IMAGE_REFERENCE } from './line-image.reference';
import { MeRequestController } from './me-request.controller';
import { MeRequestService } from './me-request.service';
import { ItemPeopleService } from './item-people.service';
import { RegistrationsService } from './registrations.service';
import { RequestItemUsageHook } from './request-item-usage.hook';
import { RequestLinesWriter } from './request-lines.writer';
import { RequestViewBuilder } from './request-view';
import { UnitsModule } from '../units/units.module';
import { ReviewController } from './review.controller';
import { ReviewWriter } from './review-writer';
import { ReviewService } from './review.service';
import { SummaryListsService } from './summary-lists.service';
import { SummaryService } from './summary.service';

@Module({
  imports: [
    CatalogModule,
    FilesModule,
    PeriodsModule,
    UsersModule,
    SystemConfigModule,
    NotificationsModule,
    UnitsModule,
  ],
  controllers: [
    CurrentPeriodController,
    MeRequestController,
    AdminSummaryController,
    AdminRequestsController,
    ReviewController,
    AdminUserHistoryController,
  ],
  providers: [
    AdminRequestService,
    CurrentPeriodService,
    RequestLinesWriter,
    RequestViewBuilder,
    MeRequestService,
    CopyPreviousService,
    HistoryService,
    RequestItemUsageHook,
    SummaryService,
    SummaryListsService,
    RegistrationsService,
    ItemPeopleService,
    ReviewService,
    ReviewWriter,
    LineDeliveryStore,
    LineNotifier,
  ],
  exports: [
    ReviewWriter,
    RequestLinesWriter,
    RequestViewBuilder,
    LineDeliveryStore,
    LineNotifier,
    SummaryService,
  ],
})
export class RequestsModule implements OnModuleInit {
  constructor(
    private readonly filePolicy: FileAccessPolicy,
    private readonly itemUsage: ItemUsageRegistry,
    private readonly usageHook: RequestItemUsageHook,
  ) {}

  onModuleInit(): void {
    this.filePolicy.registerReference(LINE_IMAGE_REFERENCE);
    this.itemUsage.register(this.usageHook);
  }
}
