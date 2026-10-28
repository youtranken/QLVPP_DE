// Bọc openid-client sau DI token để test thay bằng test-double, không cần PMH ID thật.
export const OIDC_PROVIDER = 'OIDC_PROVIDER';

export interface OidcTokens {
  accessToken: string;
  refreshToken: string | null;
  idToken: string | null;
}

export interface AuthUrlRequest {
  redirectUri: string;
  state: string;
  codeChallenge: string;
  loginHint?: string;
}

export interface CodeExchangeRequest {
  currentUrl: URL;
  redirectUri: string;
  codeVerifier: string;
  expectedState: string;
}

export interface OidcProvider {
  buildAuthUrl(req: AuthUrlRequest): Promise<string>;
  exchangeCode(req: CodeExchangeRequest): Promise<OidcTokens>;
  refresh(refreshToken: string): Promise<OidcTokens>;
  // null khi IdP không có end-session endpoint
  buildLogoutUrl(
    postLogoutRedirectUri: string,
    idTokenHint?: string | null,
  ): Promise<string | null>;
  clientCredentialsToken(forceRefresh?: boolean): Promise<string>;
}
