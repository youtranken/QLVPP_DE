import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Inject,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import type { Response } from 'express';
import { AuditWriterService } from '../audit/audit-writer.service';
import { UsersService } from '../users/users.service';
import { JwtVerifierService } from './jwt-verifier.service';
import { LOCAL_SA_SUB } from './local-sa-env';
import { LocalSaService } from './local-sa.service';
import { OIDC_PROVIDER } from './oidc-provider';
import type { OidcProvider } from './oidc-provider';
import { Public } from './public.decorator';
import { Throttle } from '@nestjs/throttler';
import { SaLoginDto } from './sa-login.dto';
import { SessionService } from './session.service';
import { SESSION_COOKIE } from './identity.guard';
import type { AuthedRequest } from './identity.types';

// Dùng req.ip (trust proxy theo số hop), không tự parse XFF trái — client tự đặt được để né lockout.
export function clientIp(req: AuthedRequest): string {
  return req.ip || req.socket.remoteAddress || 'unknown';
}

const OIDC_TX_COOKIE = 'vpp_oidc_tx';

function sanitizeLoginHint(raw?: string): string | undefined {
  const v = raw?.trim();
  if (!v || v.length > 200) return undefined;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? v : undefined;
}

function appBaseUrl(): string {
  return process.env.APP_BASE_URL ?? 'http://localhost:8080';
}

function redirectUri(): string {
  return `${appBaseUrl()}/api/auth/callback`;
}

function pkceChallenge(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url');
}

// http trên LAN mà ép Secure thì browser bỏ cookie → vòng lặp đăng nhập; localhost được coi là an toàn.
export function cookieSecure(): boolean {
  const url = new URL(appBaseUrl());
  return (
    url.protocol === 'https:' ||
    url.hostname === 'localhost' ||
    url.hostname === '127.0.0.1'
  );
}

@Controller('auth')
export class AuthController {
  constructor(
    @Inject(OIDC_PROVIDER) private readonly oidc: OidcProvider,
    private readonly jwtVerifier: JwtVerifierService,
    private readonly sessions: SessionService,
    private readonly users: UsersService,
    private readonly audit: AuditWriterService,
    private readonly localSa: LocalSaService,
  ) {}

  @Public()
  @Throttle({ ip: { limit: 10, ttl: 60_000 } })
  @Post('sa-login')
  @HttpCode(200)
  async saLogin(
    @Body() dto: SaLoginDto,
    @Req() req: AuthedRequest,
    @Res() res: Response,
  ): Promise<void> {
    const ip = clientIp(req);
    const result = this.localSa.attemptLogin(dto.username, dto.password, ip);
    if (result !== 'ok') {
      await this.audit.append({
        actor: 'system',
        action: 'auth.sa_login_failed',
        detail: { ip, reason: result },
      });
      if (result === 'locked') {
        throw new HttpException(
          {
            code: 'SA_LOGIN_LOCKED',
            message:
              'Quá nhiều lần sai — tạm khoá đăng nhập SA. Thử lại sau ít phút.',
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
      throw new UnauthorizedException({
        code: 'SA_LOGIN_INVALID',
        message: 'Sai tài khoản hoặc mật khẩu.',
      });
    }
    // SA cần users row để thỏa FK (created_by_sub…); list() vẫn loại local:sa
    await this.users.ensureLocalSa();
    const session = await this.sessions.createLocalSa();
    res.cookie(SESSION_COOKIE, session.id, {
      httpOnly: true,
      secure: cookieSecure(),
      sameSite: 'strict',
      path: '/',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });
    await this.audit.append({
      actor: LOCAL_SA_SUB,
      action: 'auth.sa_login',
      objectType: 'session',
      objectId: session.id,
      detail: { ip },
    });
    res.json({ ok: true });
  }

  @Public()
  @Get('login')
  async login(
    @Res() res: Response,
    @Query('login_hint') loginHint?: string,
  ): Promise<void> {
    const codeVerifier = randomBytes(32).toString('base64url');
    const state = randomBytes(16).toString('base64url');
    const url = await this.oidc.buildAuthUrl({
      redirectUri: redirectUri(),
      state,
      codeChallenge: pkceChallenge(codeVerifier),
      loginHint: sanitizeLoginHint(loginHint),
    });
    res.cookie(OIDC_TX_COOKIE, JSON.stringify({ codeVerifier, state }), {
      httpOnly: true,
      secure: cookieSecure(),
      sameSite: 'lax', // callback là redirect cross-site từ PMH ID — Strict làm rơi cookie
      maxAge: 10 * 60 * 1000,
      path: '/api/auth',
    });
    res.redirect(url);
  }

  // Public: user bị chặn không có phiên app; phải qua end_session vì app không tự hủy phiên SSO được.
  @Public()
  @Get('switch-account')
  async switchAccount(
    @Req() req: AuthedRequest,
    @Res() res: Response,
  ): Promise<void> {
    // Guard đã lọc cookie không phải UUID (Postgres ném 22P02 → 500)
    const sid = req.user?.sessionId;
    let idTokenHint: string | null = null;
    if (sid) {
      const session = await this.sessions.find(sid);
      idTokenHint = session?.idToken ?? null;
      await this.sessions.destroy(sid);
    }
    res.clearCookie(SESSION_COOKIE);
    // post_logout_redirect_uri phải khớp hệt app_url đã khai với PMH ID
    const logoutUrl = await this.oidc.buildLogoutUrl(appBaseUrl(), idTokenHint);
    // Không có end_session thì không về /api/auth/login: phiên SSO còn sống sẽ lặp forbidden
    res.redirect(logoutUrl ?? '/?login=failed');
  }

  @Public()
  @Get('callback')
  async callback(
    @Req() req: AuthedRequest,
    @Res() res: Response,
  ): Promise<void> {
    const txRaw = (req.cookies as Record<string, string> | undefined)?.[
      OIDC_TX_COOKIE
    ];
    res.clearCookie(OIDC_TX_COOKIE, { path: '/api/auth' });
    try {
      const currentUrl = new URL(req.originalUrl, appBaseUrl());
      // Bắt buộc cookie giao dịch kể cả nhánh ?error — chặn callback giả mạo spam audit
      if (!txRaw) {
        throw new Error(
          'Thiếu cookie giao dịch OIDC (hết hạn 10 phút hoặc cookie bị chặn)',
        );
      }
      // access_denied = PMH ID không cho vào VPP (khóa/xóa/không được cấp app) — báo không có quyền thay vì thử lại
      const idpError = currentUrl.searchParams.get('error');
      if (idpError) {
        const denied = idpError === 'access_denied';
        await this.audit.append({
          actor: 'system',
          action: denied ? 'auth.login_denied_idp' : 'auth.login_failed',
          detail: {
            error: idpError.slice(0, 100),
            error_description:
              currentUrl.searchParams.get('error_description')?.slice(0, 200) ??
              null,
          },
        });
        res.redirect(denied ? '/?login=forbidden' : '/?login=failed');
        return;
      }
      const tx = JSON.parse(txRaw) as { codeVerifier: string; state: string };
      const tokens = await this.oidc.exchangeCode({
        currentUrl,
        redirectUri: redirectUri(),
        codeVerifier: tx.codeVerifier,
        expectedState: tx.state,
      });
      const verified = await this.jwtVerifier.verify(tokens.accessToken);

      await this.users.upsertFromClaims(verified.claims);
      const session = await this.sessions.create({
        userSub: verified.claims.sub,
        refreshToken: tokens.refreshToken,
        accessTokenExp: verified.expiresAt,
        claims: verified.claims,
        idToken: tokens.idToken,
      });
      res.cookie(SESSION_COOKIE, session.id, {
        httpOnly: true,
        secure: cookieSecure(),
        sameSite: 'strict',
        path: '/',
        maxAge: 30 * 24 * 60 * 60 * 1000,
      });
      await this.audit.append({
        actor: verified.claims.sub,
        action: 'auth.login',
        objectType: 'session',
        objectId: session.id,
      });
      res.redirect('/');
    } catch (error) {
      await this.audit.append({
        actor: 'system',
        action: 'auth.login_failed',
        detail: { message: (error as Error).message },
      });
      // Callback là navigation của browser — redirect để FE hiện thông báo thay vì JSON thô
      res.redirect('/?login=failed');
    }
  }
}
