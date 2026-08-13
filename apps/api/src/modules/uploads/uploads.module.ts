import { Module } from '@nestjs/common';
import { UploadsController } from './uploads.controller';

/** Ảnh lưu trên ĐĨA CỤC BỘ, không dùng object storage (ADR-0007). */
@Module({ controllers: [UploadsController] })
export class UploadsModule {}
