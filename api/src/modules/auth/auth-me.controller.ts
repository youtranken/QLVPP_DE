import {
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import type { Response } from 'express';
import { AuditWriterService } from '../audit/audit-writer.service';
import { SystemConfigService } from '../config/system-config.service';
import { UsersService } from '../users/users.service';
import type { MeResponse } from './auth.types';
import { SESSION_COOKIE } from './identity.guard';
import type { AuthedRequest } from './identity.types';
import { SessionService } from './session.service';

@Controller('auth')
export class AuthMeController {
  constructor(
    private readonly sessions: SessionService,
    private readonly users: UsersService,
    private readonly audit: AuditWriterService,
    private readonly config: SystemConfigService,
  ) {}

  @Get('me')
  async me(@Req() req: AuthedRequest): Promise<MeResponse> {
    const user = req.user;
    if (!user) {
      throw new UnauthorizedException({
        code: 'UNAUTHENTICATED',
        message: 'Chưa đăng nhập.',
      });
    }
    const [session, profile, registrationLastDay, defaultMaxQty, adminContact] =
      await Promise.all([
        user.sessionId ? this.sessions.find(user.sessionId) : null,
        this.users.findBySub(user.sub),
        this.config.getInt('registration_last_day'),
        this.config.getInt('default_max_qty'),
        this.config.get<string>('admin_contact'),
      ]);
    return {
      sub: user.sub,
      role: user.role,
      devMode: user.devMode,
      csrfToken: session?.csrfToken ?? null,
      fullName: user.fullName ?? profile?.fullName ?? null,
      email: user.email ?? profile?.email ?? null,
      department: profile?.department ?? null,
      employeeCode: profile?.employeeCode ?? null,
      // Ngôn ngữ lưu ở trình duyệt; null = server không áp đặt
      locale: null,
      config: {
        registration_last_day: registrationLastDay,
        default_max_qty: defaultMaxQty,
        admin_contact: adminContact,
      },
    };
  }

  @Post('logout')
  @HttpCode(200)
  async logout(@Req() req: AuthedRequest, @Res() res: Response): Promise<void> {
    const user = req.user;
    if (user?.sessionId) {
      await this.sessions.destroy(user.sessionId);
      await this.audit.append({
        actor: user.sub,
        action: 'auth.logout',
        objectType: 'session',
        objectId: user.sessionId,
      });
    }
    res.clearCookie(SESSION_COOKIE);
    // Không gọi end_session: phiên SSO dùng chung với portal và các app khác
    res.json({ ok: true });
  }
}
