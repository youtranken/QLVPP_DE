import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { ClockModule } from './common/clock.module';
import { IP_THROTTLER } from './common/ip-throttler.guard';
import { testOnlyControllers } from './common/client-ip.controller';
import { httpLoggerOptions } from './common/logger.config';
import { throttlePerMin } from './common/throttle-limits';
import { DatabaseModule } from './database/database.module';
import { DB_PROBE, probeDatabase } from './health/db-probe';
import { HealthController } from './health/health.controller';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { DeliveryModule } from './modules/delivery/delivery.module';
import { OidcModule } from './modules/auth/oidc.module';
import { SystemConfigModule } from './modules/config/config.module';
import { FilesModule } from './modules/files/files.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { PeriodsModule } from './modules/periods/periods.module';
import { RemindersModule } from './modules/reminders/reminders.module';
import { ReportsModule } from './modules/reports/reports.module';
import { RequestsModule } from './modules/requests/requests.module';

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        ...httpLoggerOptions(),
        level: process.env.NODE_ENV === 'test' ? 'silent' : 'info',
        transport:
          process.env.NODE_ENV === 'development'
            ? { target: 'pino-pretty', options: { singleLine: true } }
            : undefined,
      },
    }),
    // forRootAsync: đọc env lúc tạo app (test đặt THROTTLE_*_PER_MIN nhỏ trước createTestApp)
    ThrottlerModule.forRootAsync({
      useFactory: () => ({
        throttlers: [
          {
            name: 'default',
            ttl: 60_000,
            limit: throttlePerMin(process.env, 'THROTTLE_USER_PER_MIN'),
          },
          {
            name: IP_THROTTLER,
            ttl: 60_000,
            limit: throttlePerMin(process.env, 'THROTTLE_IP_PER_MIN'),
          },
        ],
      }),
    }),
    ScheduleModule.forRoot(),
    ClockModule,
    DatabaseModule,
    AuditModule,
    OidcModule,
    AuthModule,
    SystemConfigModule,
    FilesModule,
    CatalogModule,
    PeriodsModule,
    RequestsModule,
    NotificationsModule,
    DeliveryModule,
    RemindersModule,
    ReportsModule,
  ],
  controllers: [HealthController, ...testOnlyControllers(process.env)],
  providers: [
    {
      provide: DB_PROBE,
      useValue: () => probeDatabase(process.env.DATABASE_URL),
    },
  ],
})
export class AppModule {}
