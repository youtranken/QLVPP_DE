import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { PeriodsModule } from '../periods/periods.module';
import { AuditController } from './audit.controller';
import { AuditInterceptor } from './audit.interceptor';
import { AuditQueryService } from './audit-query.service';
import { AuditWriterService } from './audit-writer.service';

@Global()
@Module({
  imports: [PeriodsModule],
  controllers: [AuditController],
  providers: [
    AuditWriterService,
    AuditQueryService,
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
  exports: [AuditWriterService],
})
export class AuditModule {}
