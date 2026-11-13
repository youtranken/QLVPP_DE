import { Body, Controller, Inject, Post, Req, Res } from '@nestjs/common';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import type { Request, Response } from 'express';
import { AuditWriterService } from '../audit/audit-writer.service';
import { appBaseUrl } from './auth.controller';
import { SESSION_COOKIE } from './identity.guard';
import type { AuthedRequest } from './identity.types';
import { parseUiLocales } from './locale';
import { OIDC_PROVIDER } from './oidc-provider';
import type { OidcProvider } from './oidc-provider';
import { Public } from './public.decorator';
import { isSessionCookie, sessionRef } from './session-crypto';
import { SessionService } from './session.service';

class LogoutFormDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  csrf?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  ui_locales?: string;

  // Web đang ở phiên SA cục bộ: phiên đã mất thì cũng không đẩy sang PMH ID
  @IsOptional()
  @IsIn(['1'])
  local?: string;
}

function cookieSession(req: Request): string | null {
  const raw = (req.cookies as Record<string, string> | undefined)?.[
    SESSION_COOKIE
  ];
  return raw && isSessionCookie(raw) ? raw : null;
}

// Form gửi từ chính trang VPP (không phiên thì không có csrf để kiểm): trang khác không đẩy được người dùng ra khỏi PMH ID
function fromAppPage(req: Request): boolean {
  const site = req.headers['sec-fetch-site'];
  if (typeof site === 'string' && site !== '') return site === 'same-origin';
  return req.headers.origin === new URL(appBaseUrl()).origin;
}

/**
 * Nút Đăng xuất = đăng xuất toàn hệ (PMH_IDE README §4.5): form POST điều hướng cả trang; server xóa phiên app
 * (kiểm csrf trong thân form), ghi auth.logout, rồi 303 sang /oidc/logout với id_token_hint và
 * post_logout_redirect_uri = APP_BASE_URL (= app_url) — id_token chỉ nằm ở server. Phiên không có id_token
 * (SA cục bộ, tài khoản thử) chỉ thoát app. Phiên đã mất mà người dùng vẫn bấm từ trang VPP → /oidc/logout
 * không hint (PMH ID hỏi xác nhận). Phiên tự hết (không hoạt động, 12 h, thu hồi) không đi qua đây.
 */
@Controller('auth')
export class LogoutController {
  constructor(
    @Inject(OIDC_PROVIDER) private readonly oidc: OidcProvider,
    private readonly sessions: SessionService,
    private readonly audit: AuditWriterService,
  ) {}

  @Public()
  @Post('logout')
  async logout(
    @Req() req: AuthedRequest,
    @Res() res: Response,
    @Body() form: LogoutFormDto,
  ): Promise<void> {
    res.redirect(303, await this.target(req, res, form));
  }

  private async target(
    req: AuthedRequest,
    res: Response,
    form: LogoutFormDto,
  ): Promise<string> {
    if (req.user?.devMode) return '/';
    const locales = parseUiLocales(form.ui_locales);
    const sid = cookieSession(req);
    const ended =
      sid && form.csrf ? await this.sessions.end(sid, form.csrf) : null;
    if (ended && sid) {
      await this.audit.append({
        actor: ended.userSub,
        action: 'auth.logout',
        objectType: 'session',
        objectId: sessionRef(sid),
      });
      res.clearCookie(SESSION_COOKIE);
      if (!ended.idToken) return '/';
      return this.endSessionUrl(ended.idToken, locales);
    }
    // Phiên còn mà csrf sai/thiếu: không đăng xuất ai cả
    if (sid && (await this.sessions.find(sid))) return '/';
    res.clearCookie(SESSION_COOKIE);
    if (form.local === '1' || !fromAppPage(req)) return '/';
    return this.endSessionUrl(null, locales);
  }

  private async endSessionUrl(
    idTokenHint: string | null,
    locales: string | undefined,
  ): Promise<string> {
    return (
      (await this.oidc.buildLogoutUrl(appBaseUrl(), idTokenHint, locales)) ??
      '/'
    );
  }
}
