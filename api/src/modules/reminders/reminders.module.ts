import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import { SystemConfigModule } from '../config/config.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PeriodsModule } from '../periods/periods.module';
import { RequestsModule } from '../requests/requests.module';
import { AdmOutSettlement } from './adm-out-settlement';
import { NotificationScheduler } from './notification-scheduler';

// Tách khỏi requests/notifications: cron cần cả hai, đặt ở đâu trong đó cũng thành import vòng
@Module({
  imports: [
    RequestsModule,
    NotificationsModule,
    PeriodsModule,
    CatalogModule,
    SystemConfigModule,
  ],
  providers: [NotificationScheduler, AdmOutSettlement],
})
export class RemindersModule {}
