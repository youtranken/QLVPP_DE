import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  NotFoundException,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { AuditWriterService } from '../audit/audit-writer.service';
import { SystemConfigService } from '../config/system-config.service';
import { UsersService } from '../users/users.service';
import { clientIp, cookieSecure } from './auth.controller';
import { SESSION_COOKIE } from './identity.guard';
import type { AuthedRequest } from './identity.types';
import type { LocalTestAccount } from './local-test-accounts-env';
import { LocalTestAccountsService } from './local-test-accounts.service';
import { Public } from './public.decorator';
import { SaLoginDto } from './sa-login.dto';
import { SessionService } from './session.service';

// Tài khoản thử local — CHỈ bản dev (AUTH_DEV_MODE + NODE_ENV dev/test). Cùng luồng SA:
// throttle IP, lockout (ip, username), so hash hằng thời gian, audit; phiên là phiên thường.
@Controller('auth')
export class LocalTestLoginController {
  constructor(
    private readonly testAccounts: LocalTestAccountsService,
    private readonly sessions: SessionService,
    private readonly users: UsersService,
    private readonly audit: AuditWriterService,
    private readonly config: SystemConfigService,
  ) {}

  // Trang đăng nhập đọc khi chưa có phiên — chỉ lộ cờ bật/tắt, không lộ danh sách username
  @Public()
  @Get('config')
  authConfig(): { testAccounts: boolean } {
    return { testAccounts: this.testAccounts.enabled };
  }

  @Public()
  @Throttle({ ip: { limit: 10, ttl: 60_000 } })
  @Post('test-login')
  @HttpCode(200)
  async testLogin(
    @Body() dto: SaLoginDto,
    @Req() req: AuthedRequest,
    @Res() res: Response,
  ): Promise<void> {
    if (!this.testAccounts.enabled) {
      throw new NotFoundException();
    }
    const ip = clientIp(req);
    const { result, account } = this.testAccounts.attemptLogin(
      dto.username,
      dto.password,
      ip,
    );
    if (result !== 'ok' || !account) {
      await this.rejectLogin(ip, result);
    }
    const sessionId = await this.openSession(account!);
    res.cookie(SESSION_COOKIE, sessionId, {
      httpOnly: true,
      secure: cookieSecure(),
      sameSite: 'strict',
      path: '/',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });
    await this.audit.append({
      actor: account!.sub,
      action: 'auth.test_login',
      objectType: 'session',
      objectId: sessionId,
      detail: { ip },
    });
    res.json({ ok: true });
  }

  private async rejectLogin(ip: string, result: string): Promise<never> {
    await this.audit.append({
      actor: 'system',
      action: 'auth.test_login_failed',
      detail: { ip, reason: result },
    });
    if (result === 'locked') {
      throw new HttpException(
        {
          code: 'TEST_LOGIN_LOCKED',
          message: 'Quá nhiều lần sai — tạm khoá. Thử lại sau ít phút.',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    throw new UnauthorizedException({
      code: 'TEST_LOGIN_INVALID',
      message: 'Sai tài khoản hoặc mật khẩu.',
    });
  }

  private async openSession(account: LocalTestAccount): Promise<string> {
    const groups =
      account.role === 'admin' ? [await this.config.getAdminGroup()] : [];
    await this.users.upsertLocalTestAccount({
      sub: account.sub,
      fullName: account.name,
      email: account.email,
      department: account.department,
      team: account.team,
      role: account.role,
      groups,
    });
    const session = await this.sessions.create({
      userSub: account.sub,
      refreshToken: null,
      accessTokenExp: null,
      claims: {
        sub: account.sub,
        full_name: account.name,
        email: account.email ?? undefined,
        department: account.department ?? undefined,
        team: account.team ?? undefined,
        groups,
      },
      idToken: null,
    });
    return session.id;
  }
}
