import { Module } from '@nestjs/common';
import { AuditService } from './audit.service';

/** Ghi & đọc nhật ký audit. Nhiều module nghiệp vụ cùng dùng nên tách riêng. */
@Module({
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
