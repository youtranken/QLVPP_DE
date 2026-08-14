import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { UploadsCleanupController, UploadsCleanupJob } from './uploads-cleanup.controller';
import { UploadsCleanupService } from './uploads-cleanup.service';
import { UploadsController } from './uploads.controller';

/** Ảnh lưu trên ĐĨA CỤC BỘ, không dùng object storage (ADR-0007). */
@Module({
  imports: [AuditModule],
  controllers: [UploadsController, UploadsCleanupController],
  providers: [UploadsCleanupService, UploadsCleanupJob],
  exports: [UploadsCleanupService],
})
export class UploadsModule {}
