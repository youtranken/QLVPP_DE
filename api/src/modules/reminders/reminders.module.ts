import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PeriodsModule } from '../periods/periods.module';
import { RequestsModule } from '../requests/requests.module';
import { NotificationScheduler } from './notification-scheduler';

// Tách khỏi requests/notifications: cron cần cả hai, đặt ở đâu trong đó cũng thành import vòng
@Module({
  imports: [RequestsModule, NotificationsModule, PeriodsModule, CatalogModule],
  providers: [NotificationScheduler],
})
export class RemindersModule {}
