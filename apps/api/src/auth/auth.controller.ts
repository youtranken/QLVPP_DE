import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Logger,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { parseEnv, type AppConfig } from '../infra/config/env';
import { AuthService } from './auth.service';
import {
  readTransaction,
  sessionCookieOptions,
  signTransaction,
  SESSION_COOKIE,
  TRANSACTION_COOKIE,
  transactionCookieOptions,
} from './cookies';
import { OidcService, type LoginTransaction } from './oidc.service';
import { Public } from './public.decorator';

/**
 * Endpoint xác thực theo mẫu BFF — SSO-INTEGRATION §6.
 * Cả controller là `@Public`: đây chính là chỗ phiên được TẠO RA, nên không thể
 * yêu cầu đã đăng nhập. Các route logout tự xử lý khi không có phiên.
 */
@Public()
@Controller('api/auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);
  private readonly config: AppConfig = parseEnv();

  constructor(
    private readonly oidc: OidcService,
    private readonly auth: AuthService,
  ) {}

  /** Bước 1: chuyển hướng sang PMH ID (PKCE S256 + state + nonce). */
  @Get('login')
  async login(@Res() res: Response): Promise<void> {
    const { url, transaction } = await this.oidc.createAuthorizationUrl();
    const signed = await signTransaction(this.config, { ...transaction });
    res.cookie(TRANSACTION_COOKIE, signed, transactionCookieOptions(this.config));
    res.redirect(url);
  }

  /**
   * Bước 2: IdP gọi về kèm `code`. Đổi lấy token, upsert user, mở phiên, set cookie.
   * `error=access_denied` ⇒ đưa về trang "chưa được cấp quyền" của web.
   */
  @Get('callback')
  async callback(
    @Req() req: Request,
    @Res() res: Response,
    @Query() query: Record<string, string>,
  ): Promise<void> {
    if (query.error) {
      this.logger.warn(`IdP từ chối đăng nhập: ${query.error}`);
      res.redirect(
        `${this.config.APP_BASE_URL}/khong-co-quyen?error=${encodeURIComponent(query.error)}`,
      );
      return;
    }

    const transaction = (await readTransaction(
      this.config,
      req.cookies?.[TRANSACTION_COOKIE] as string | undefined,
    )) as LoginTransaction | null;

    res.clearCookie(TRANSACTION_COOKIE, sessionCookieOptions(this.config, 0));

    if (!transaction) {
      // Cookie hết hạn/bị mất ⇒ không kiểm được state, buộc đăng nhập lại từ đầu.
      res.redirect(`${this.config.APP_BASE_URL}/dang-nhap?error=phien_dang_nhap_het_han`);
      return;
    }

    try {
      const tokenSet = await this.oidc.exchangeCode(query, transaction);
      const user = await this.auth.upsertUserFromClaims(this.oidc.extractClaims(tokenSet));
      const session = await this.auth.createSession(user.id, tokenSet);
      res.cookie(
        SESSION_COOKIE,
        session.id,
        sessionCookieOptions(this.config, session.expiresAt.getTime() - Date.now()),
      );
      res.redirect(`${this.config.APP_BASE_URL}/`);
    } catch (error) {
      this.logger.error('Đổi code lấy token thất bại', error as Error);
      res.redirect(`${this.config.APP_BASE_URL}/dang-nhap?error=dang_nhap_that_bai`);
    }
  }

  /** Đăng xuất LOCAL: huỷ phiên app, KHÔNG gọi IdP (README PMH ID §4.5). */
  @Post('logout')
  @HttpCode(204)
  async logout(@Req() req: Request, @Res() res: Response): Promise<void> {
    const sessionId = req.cookies?.[SESSION_COOKIE] as string | undefined;
    if (sessionId) await this.auth.destroySession(sessionId);
    res.clearCookie(SESSION_COOKIE, sessionCookieOptions(this.config, 0));
    res.send();
  }

  /** Đăng xuất TOÀN HỆ: huỷ phiên app rồi đẩy sang `end_session` của IdP. */
  @Get('logout-global')
  async logoutGlobal(@Req() req: Request, @Res() res: Response): Promise<void> {
    const sessionId = req.cookies?.[SESSION_COOKIE] as string | undefined;
    const session = await this.auth.findActiveSession(sessionId);
    if (sessionId) await this.auth.destroySession(sessionId);
    res.clearCookie(SESSION_COOKIE, sessionCookieOptions(this.config, 0));
    res.redirect(await this.oidc.endSessionUrl(session?.idToken ?? null));
  }

  /**
   * IdP → app: nhận `logout_token`, verify chữ ký, huỷ mọi phiên của `sub`.
   * Idempotent: gọi lại nhiều lần vẫn trả 200 (IdP có cơ chế retry).
   */
  @Post('backchannel-logout')
  @HttpCode(200)
  async backchannelLogout(@Body() body: Record<string, string>): Promise<{ ok: boolean }> {
    let payload: Awaited<ReturnType<OidcService['verifyLogoutToken']>>;
    try {
      payload = await this.oidc.verifyLogoutToken(body.logout_token);
    } catch (error) {
      // Spec back-channel logout: token không hợp lệ ⇒ 400 để IdP biết mà báo lỗi.
      this.logger.warn(`logout_token không hợp lệ: ${(error as Error).message}`);
      throw new BadRequestException('logout_token không hợp lệ');
    }
    const removed = payload.sub ? await this.auth.destroySessionsBySub(String(payload.sub)) : 0;
    this.logger.log(`Back-channel logout cho sub=${String(payload.sub)}: huỷ ${removed} phiên`);
    return { ok: true };
  }
}
