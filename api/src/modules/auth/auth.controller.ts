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
import type { CookieOptions, Response } from 'express';
import { AuditWriterService } from '../audit/audit-writer.service';
import { UsersService } from '../users/users.service';
import { JwtVerifierService } from './jwt-verifier.service';
import type { VerifiedAccessToken } from './jwt-verifier.service';
import { LOCAL_SA_SUB } from './local-sa-env';
import { LocalSaService } from './local-sa.service';
import { parseUiLocales } from './locale';
import { OIDC_PROVIDER } from './oidc-provider';
import type { OidcProvider, OidcTokens } from './oidc-provider';
import { Public } from './public.decorator';
import { Throttle } from '@nestjs/throttler';
import { IdentifyDto, SaLoginDto } from './sa-login.dto';
import { SessionService } from './session.service';
import { TokenContractError } from './token-contract.error';
import { SESSION_COOKIE } from './identity.guard';
import { sessionRef } from './session-crypto';
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

export function appBaseUrl(): string {
  return process.env.APP_BASE_URL ?? 'http://localhost:8080';
}

function redirectUri(): string {
  return `${appBaseUrl()}/api/auth/callback`;
}

function pkceChallenge(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url');
}

// Cookie phiên vpp_sid: không maxAge (cookie phiên trình duyệt) — hạn thật là 12 h ở server (expires_at)
export function sessionCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: cookieSecure(),
    sameSite: 'strict',
    path: '/',
  };
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
    res.cookie(SESSION_COOKIE, session.id, sessionCookieOptions());
    await this.audit.append({
      actor: LOCAL_SA_SUB,
      action: 'auth.sa_login',
      objectType: 'session',
      objectId: sessionRef(session.id),
      detail: { ip },
    });
    res.json({ ok: true });
  }

  // Ô đăng nhập gõ chữ không phải email: chỉ đúng hệt tên SA trong env mới sang bước mật khẩu. Tên SA không có
  // trong bundle web hay public-config; trả đúng một trong hai dạng, giới hạn 10 lần/phút/IP để không dò tên được.
  @Public()
  @Throttle({ ip: { limit: 10, ttl: 60_000 } })
  @Post('identify')
  @HttpCode(200)
  identify(@Body() dto: IdentifyDto): { next: 'password' | 'invalid' } {
    return {
      next: this.localSa.isSaUsername(dto.identifier) ? 'password' : 'invalid',
    };
  }

  @Public()
  @Get('login')
  async login(
    @Res() res: Response,
    @Query('login_hint') loginHint?: string,
    @Query('ui_locales') uiLocales?: string,
  ): Promise<void> {
    res.redirect(
      await this.startLogin(res, {
        loginHint: sanitizeLoginHint(loginHint),
        // Ngôn ngữ app đang dùng (docs 7a) — chỉ vi|en; lạ/thiếu → không gửi
        uiLocales: parseUiLocales(uiLocales),
      }),
    );
  }

  // Đặt cookie giao dịch PKCE/state, trả URL authorize của PMH ID
  private async startLogin(
    res: Response,
    opts: { loginHint?: string; uiLocales?: string; prompt?: 'login' },
  ): Promise<string> {
    const codeVerifier = randomBytes(32).toString('base64url');
    const state = randomBytes(16).toString('base64url');
    const url = await this.oidc.buildAuthUrl({
      redirectUri: redirectUri(),
      state,
      codeChallenge: pkceChallenge(codeVerifier),
      ...opts,
    });
    res.cookie(OIDC_TX_COOKIE, JSON.stringify({ codeVerifier, state }), {
      httpOnly: true,
      secure: cookieSecure(),
      sameSite: 'lax', // callback là redirect cross-site từ PMH ID — Strict làm rơi cookie
      maxAge: 10 * 60 * 1000,
      path: '/api/auth',
    });
    return url;
  }

  // Public: user bị chặn (forbidden) không có phiên app. Có id_token → end_session (hủy phiên SSO);
  // không có (nhánh access_denied/revoked chưa tạo phiên) → PMH ID 500 khi logout thiếu hint,
  // nên đi authorize với prompt=login: PMH ID hiện form đăng nhập dù phiên SSO còn, chọn được tài khoản khác.
  @Public()
  @Get('switch-account')
  async switchAccount(
    @Req() req: AuthedRequest,
    @Res() res: Response,
    @Query('ui_locales') uiLocales?: string,
  ): Promise<void> {
    const sid = req.user?.sessionId;
    let idTokenHint: string | null = null;
    if (sid) {
      const session = await this.sessions.find(sid);
      idTokenHint = session?.idToken ?? null;
      await this.sessions.destroy(sid);
    }
    res.clearCookie(SESSION_COOKIE);
    const locales = parseUiLocales(uiLocales);
    if (idTokenHint) {
      // post_logout_redirect_uri phải khớp hệt app_url đã khai với PMH ID
      const logoutUrl = await this.oidc.buildLogoutUrl(
        appBaseUrl(),
        idTokenHint,
        locales,
      );
      if (logoutUrl) {
        res.redirect(logoutUrl);
        return;
      }
    }
    res.redirect(
      await this.startLogin(res, { prompt: 'login', uiLocales: locales }),
    );
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
      res.redirect(await this.openSsoSession(res, tokens, verified));
    } catch (error) {
      await this.audit.append({
        actor: 'system',
        action: 'auth.login_failed',
        detail:
          error instanceof TokenContractError
            ? { reason: 'token_ver', ver: error.ver ?? null }
            : { message: (error as Error).message },
      });
      // Callback là navigation của browser — redirect để FE hiện thông báo thay vì JSON thô
      res.redirect('/?login=failed');
    }
  }

  // Tạo phiên sau khi token hợp lệ; trả đích redirect
  private async openSsoSession(
    res: Response,
    tokens: OidcTokens,
    verified: VerifiedAccessToken,
  ): Promise<string> {
    const access = await this.users.upsertFromClaims(
      verified.claims,
      verified.issuedAt,
    );
    if (access === 'revoked') {
      // PMH ID thu hồi quyền vào VPP sau lúc phát token này → không mở lại, không tạo phiên
      await this.audit.append({
        actor: verified.claims.sub,
        action: 'auth.login_denied_revoked',
        objectType: 'user',
        objectId: verified.claims.sub,
        detail: { iat: verified.issuedAt?.toISOString() ?? null },
      });
      return '/?login=forbidden';
    }
    const session = await this.sessions.create({
      userSub: verified.claims.sub,
      refreshToken: tokens.refreshToken,
      accessToken: tokens.accessToken,
      accessTokenExp: verified.expiresAt,
      claims: verified.claims,
      idToken: tokens.idToken,
    });
    res.cookie(SESSION_COOKIE, session.id, sessionCookieOptions());
    await this.audit.append({
      actor: verified.claims.sub,
      action: 'auth.login',
      objectType: 'session',
      objectId: sessionRef(session.id),
    });
    return '/';
  }
}
