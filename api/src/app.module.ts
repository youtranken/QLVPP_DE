import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { testOnlyControllers } from './common/client-ip.controller';
import { httpLoggerOptions } from './common/logger.config';
import { UserThrottlerGuard } from './common/user-throttler.guard';
import { DatabaseModule } from './database/database.module';
import { HealthController } from './health/health.controller';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { OidcModule } from './modules/auth/oidc.module';
import { SystemConfigModule } from './modules/config/config.module';

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
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60_000, limit: 300 }],
    }),
    ScheduleModule.forRoot(),
    DatabaseModule,
    AuditModule,
    OidcModule,
    AuthModule,
    SystemConfigModule,
  ],
  controllers: [HealthController, ...testOnlyControllers(process.env)],
  // Đăng ký sau AuthModule → chạy sau IdentityGuard, req.user có sẵn cho tracker theo user
  providers: [{ provide: APP_GUARD, useClass: UserThrottlerGuard }],
})
export class AppModule {}
