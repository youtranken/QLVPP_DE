import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';

/**
 * Cài đặt toàn hệ thống. Gần như module nghiệp vụ nào cũng phải hỏi khung ngày
 * đăng ký nên service được export ra ngoài.
 */
@Module({
  imports: [AuditModule],
  controllers: [SettingsController],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
