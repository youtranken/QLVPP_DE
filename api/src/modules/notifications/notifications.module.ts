import { Module } from '@nestjs/common';
import { SystemConfigModule } from '../config/config.module';
import { MailModule } from '../mail/mail.module';
import { PeriodsModule } from '../periods/periods.module';
import { UsersModule } from '../users/users.module';
import { LeftWorkAlertService } from './left-work-alert.service';
import { MeNotificationsController } from './me-notifications.controller';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [UsersModule, SystemConfigModule, PeriodsModule, MailModule],
  controllers: [MeNotificationsController],
  providers: [NotificationsService, LeftWorkAlertService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
