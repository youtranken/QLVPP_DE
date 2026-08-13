import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { AuditModule } from '../audit/audit.module';
import {
  DepartmentsController,
  DirectoryController,
  DirectorySyncJob,
} from './directory.controller';
import { DirectoryService } from './directory.service';
import { WebhooksController } from './webhooks.controller';

/** Danh bạ (Directory API) + webhook sự kiện người dùng từ PMH ID. */
@Module({
  imports: [AuthModule, AuditModule],
  controllers: [DirectoryController, DepartmentsController, WebhooksController],
  providers: [DirectoryService, DirectorySyncJob],
  exports: [DirectoryService],
})
export class DirectoryModule {}
