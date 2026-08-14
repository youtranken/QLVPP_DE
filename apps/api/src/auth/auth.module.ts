import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { SettingsModule } from '../modules/settings/settings.module';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { MeController } from './me.controller';
import { OidcService } from './oidc.service';
import { RolesGuard } from './roles.decorator';

/**
 * Xác thực PMH ID SSO theo mẫu BFF.
 * AuthGuard đăng ký TOÀN CỤC — mặc định mọi route đều phải đăng nhập;
 * route công khai phải khai báo tường minh bằng `@Public()`.
 */
@Module({
  imports: [SettingsModule],
  controllers: [AuthController, MeController],
  providers: [
    OidcService,
    AuthService,
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
  exports: [AuthService, OidcService],
})
export class AuthModule {}
