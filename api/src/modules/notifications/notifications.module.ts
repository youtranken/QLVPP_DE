import { Module } from '@nestjs/common';
import { SystemConfigModule } from '../config/config.module';
import { UsersModule } from '../users/users.module';
import { MeNotificationsController } from './me-notifications.controller';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [UsersModule, SystemConfigModule],
  controllers: [MeNotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
