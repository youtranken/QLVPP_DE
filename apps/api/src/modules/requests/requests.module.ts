import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AdminRequestsController } from './admin-requests.controller';
import { AdminRequestsService } from './admin-requests.service';
import { RequestsController } from './requests.controller';
import { RequestsService } from './requests.service';

@Module({
  imports: [AuditModule, NotificationsModule],
  controllers: [RequestsController, AdminRequestsController],
  providers: [RequestsService, AdminRequestsService],
  exports: [RequestsService, AdminRequestsService],
})
export class RequestsModule {}
