// Bọc openid-client sau DI token để test thay bằng test-double, không cần PMH ID thật.
export const OIDC_PROVIDER = 'OIDC_PROVIDER';

export interface OidcTokens {
  accessToken: string;
  refreshToken: string | null;
  idToken: string | null;
  // claim sid của id_token (phiên SSO) — chỉ có khi PMH ID bật sid
  sid?: string | null;
}

export interface AuthUrlRequest {
  redirectUri: string;
  state: string;
  codeChallenge: string;
  loginHint?: string;
  // Ngôn ngữ app đang dùng (docs 7a) — chỉ quyết định trang PMH ID hiển thị
  uiLocales?: string;
  // 'login' = PMH ID bắt nhập lại dù phiên SSO còn — để chọn tài khoản khác (oidc-provider không hỗ trợ select_account)
  prompt?: 'login';
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
    uiLocales?: string,
  ): Promise<string | null>;
  clientCredentialsToken(forceRefresh?: boolean): Promise<string>;
}

// Hạn giờ (giây) cho mỗi lời gọi HTTP tới PMH ID qua openid-client (discovery, token, refresh,
// client_credentials). PMH ID treo không giữ request/hàng đợi lưu ngôn ngữ mãi; hết giờ = lỗi mạng.
export const IDP_HTTP_TIMEOUT_SEC = 10;
