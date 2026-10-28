import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { IpThrottlerGuard } from '../../common/ip-throttler.guard';
import { UserThrottlerGuard } from '../../common/user-throttler.guard';
import { SystemConfigModule } from '../config/config.module';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthMeController } from './auth-me.controller';
import { BackchannelLogoutController } from './backchannel-logout.controller';
import { CsrfGuard } from './csrf.guard';
import { IdentityGuard } from './identity.guard';
import { LocalSaService } from './local-sa.service';
import { RolesGuard } from './roles.guard';
import { SessionAuthService } from './session-auth.service';
import { SessionService } from './session.service';
import { WebhookController } from './webhook.controller';

@Module({
  imports: [UsersModule, SystemConfigModule],
  controllers: [
    AuthController,
    AuthMeController,
    BackchannelLogoutController,
    WebhookController,
  ],
  providers: [
    SessionService,
    SessionAuthService,
    LocalSaService,
    // Thứ tự đăng ký = thứ tự chạy: IP throttle → Identity → CSRF → Roles → user throttle (cần req.user)
    { provide: APP_GUARD, useClass: IpThrottlerGuard },
    { provide: APP_GUARD, useClass: IdentityGuard },
    { provide: APP_GUARD, useClass: CsrfGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: UserThrottlerGuard },
  ],
  exports: [SessionService],
})
export class AuthModule {}
