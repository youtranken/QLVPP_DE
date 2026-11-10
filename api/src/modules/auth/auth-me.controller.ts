import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Put,
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
import { clientIp } from './auth.controller';
import { normalizeLocale, parseLocaleTag } from './locale';
import { LocaleSyncService } from './locale-sync.service';
import type { LocaleSaveResult } from './locale-sync.service';
import { isPmhSession } from './session-auth.service';
import { SessionService } from './session.service';
import { SetLocaleDto } from './set-locale.dto';

@Controller('auth')
export class AuthMeController {
  constructor(
    private readonly sessions: SessionService,
    private readonly users: UsersService,
    private readonly audit: AuditWriterService,
    private readonly config: SystemConfigService,
    private readonly localeSync: LocaleSyncService,
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
    // Ngôn ngữ = tài khoản PMH ID (docs 7a): claim của phiên SSO; không lưu ở DB của VPP
    const pmh = session && !user.devMode && isPmhSession(session);
    return {
      sub: user.sub,
      role: user.role,
      devMode: user.devMode,
      csrfToken: session?.csrfToken ?? null,
      fullName: user.fullName ?? profile?.fullName ?? null,
      email: user.email ?? profile?.email ?? null,
      department: profile?.department ?? null,
      employeeCode: profile?.employeeCode ?? null,
      locale: pmh ? normalizeLocale(session.claims?.locale) : null,
      localeUpdatedAt: pmh ? (session.claims?.locale_updated_at ?? null) : null,
      serverTime: Date.now(),
      config: {
        registration_last_day: registrationLastDay,
        default_max_qty: defaultMaxQty,
        admin_contact: adminContact,
      },
    };
  }

  /**
   * Người dùng đổi VI/EN trong VPP (docs 7a): lưu vào tài khoản PMH ID bằng access token của phiên.
   * Lỗi PMH ID không làm hỏng thao tác, không đăng xuất: 200 `saved:false` + lý do (giao diện vẫn
   * giữ lựa chọn). SA local / tài khoản thử / dev mode: không có token PMH ID → không gọi IdP.
   */
  @Put('me/locale')
  @HttpCode(200)
  async setLocale(
    @Req() req: AuthedRequest,
    @Body() dto: SetLocaleDto,
  ): Promise<LocaleSaveResult> {
    const locale = parseLocaleTag(dto.locale);
    if (!locale) {
      throw new BadRequestException({
        code: 'INVALID_LOCALE',
        message: 'Ngôn ngữ không hợp lệ (vi | en).',
      });
    }
    const user = req.user;
    const session =
      user?.sessionId && !user.devMode
        ? await this.sessions.find(user.sessionId)
        : null;
    if (!session || !isPmhSession(session)) {
      return { locale, saved: false, reason: 'local_session' };
    }
    const click =
      dto.page !== undefined && dto.seq !== undefined
        ? { page: dto.page, seq: dto.seq }
        : undefined;
    return this.localeSync.save(session.id, locale, clientIp(req), click);
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
