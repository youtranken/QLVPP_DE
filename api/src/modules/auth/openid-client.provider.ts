import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import type * as oidc from 'openid-client';
import type {
  AuthUrlRequest,
  CodeExchangeRequest,
  OidcProvider,
  OidcTokens,
} from './oidc-provider';
import { IDP_HTTP_TIMEOUT_SEC } from './oidc-provider';

@Injectable()
export class OpenidClientProvider implements OidcProvider {
  private readonly logger = new Logger(OpenidClientProvider.name);
  private config: oidc.Configuration | null = null;
  private lib: typeof oidc | null = null;

  private assertConfigured(): void {
    if (
      !process.env.PMH_ISSUER_URL ||
      !process.env.PMH_CLIENT_ID ||
      !process.env.PMH_CLIENT_SECRET
    ) {
      throw new ServiceUnavailableException({
        code: 'SSO_NOT_CONFIGURED',
        message:
          'SSO chưa được cấu hình (PMH_ISSUER_URL/PMH_CLIENT_ID/PMH_CLIENT_SECRET) — liên hệ SA cấp client PMH ID.',
      });
    }
  }

  private async getConfig(): Promise<{
    lib: typeof oidc;
    config: oidc.Configuration;
  }> {
    this.assertConfigured();
    if (this.config && this.lib) {
      return { lib: this.lib, config: this.config };
    }
    // openid-client v6 là ESM-only
    const lib = await import('openid-client');
    try {
      const config = await lib.discovery(
        new URL(process.env.PMH_ISSUER_URL as string),
        process.env.PMH_CLIENT_ID as string,
        undefined,
        // PMH ID nhận client_secret_basic (v6 mặc định là _post → token endpoint từ chối)
        lib.ClientSecretBasic(process.env.PMH_CLIENT_SECRET),
        // gán luôn cho cấu hình ⇒ mọi lời gọi sau (token/refresh) cũng có hạn giờ (mặc định 30 s)
        { timeout: IDP_HTTP_TIMEOUT_SEC },
      );
      this.lib = lib;
      this.config = config;
      return { lib, config };
    } catch (error) {
      this.logger.error(`OIDC discovery thất bại: ${(error as Error).message}`);
      throw new ServiceUnavailableException({
        code: 'SSO_UNAVAILABLE',
        message:
          'Không kết nối được Tài khoản D&E — thử lại sau (đăng nhập mới tạm thời không khả dụng).',
      });
    }
  }

  async buildAuthUrl(req: AuthUrlRequest): Promise<string> {
    const { lib, config } = await this.getConfig();
    const url = lib.buildAuthorizationUrl(config, {
      redirect_uri: req.redirectUri,
      scope: 'openid profile',
      state: req.state,
      code_challenge: req.codeChallenge,
      code_challenge_method: 'S256',
      ...(req.loginHint ? { login_hint: req.loginHint } : {}),
      ...(req.uiLocales ? { ui_locales: req.uiLocales } : {}),
      ...(req.prompt ? { prompt: req.prompt } : {}),
    });
    return url.href;
  }

  async exchangeCode(req: CodeExchangeRequest): Promise<OidcTokens> {
    const { lib, config } = await this.getConfig();
    const tokens = await lib.authorizationCodeGrant(config, req.currentUrl, {
      pkceCodeVerifier: req.codeVerifier,
      expectedState: req.expectedState,
    });
    return {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? null,
      idToken: tokens.id_token ?? null,
    };
  }

  async refresh(refreshToken: string): Promise<OidcTokens> {
    const { lib, config } = await this.getConfig();
    const tokens = await lib.refreshTokenGrant(config, refreshToken);
    return {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? refreshToken,
      idToken: tokens.id_token ?? null,
    };
  }

  private m2mToken: { value: string; expiresAt: number } | null = null;
  private m2mInflight: Promise<string> | null = null;

  async clientCredentialsToken(forceRefresh = false): Promise<string> {
    if (forceRefresh) {
      this.m2mToken = null;
    }
    if (this.m2mToken && this.m2mToken.expiresAt > Date.now() + 30_000) {
      return this.m2mToken.value;
    }
    // Single-flight: nhiều lời gọi Directory song song chỉ xin một grant
    if (this.m2mInflight) {
      return this.m2mInflight;
    }
    this.m2mInflight = this.requestM2mToken().finally(() => {
      this.m2mInflight = null;
    });
    return this.m2mInflight;
  }

  private async requestM2mToken(): Promise<string> {
    const { lib, config } = await this.getConfig();
    const tokens = await lib.clientCredentialsGrant(config, {});
    this.m2mToken = {
      value: tokens.access_token,
      expiresAt: Date.now() + (tokens.expiresIn() ?? 300) * 1000,
    };
    return this.m2mToken.value;
  }

  async buildLogoutUrl(
    postLogoutRedirectUri: string,
    idTokenHint?: string | null,
    uiLocales?: string,
  ): Promise<string | null> {
    try {
      const { lib, config } = await this.getConfig();
      const url = lib.buildEndSessionUrl(config, {
        post_logout_redirect_uri: postLogoutRedirectUri,
        ...(idTokenHint ? { id_token_hint: idTokenHint } : {}),
        ...(uiLocales ? { ui_locales: uiLocales } : {}),
      });
      return url.href;
    } catch {
      return null;
    }
  }
}
