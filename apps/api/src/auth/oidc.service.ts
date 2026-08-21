import { Injectable, Logger } from '@nestjs/common';
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import { Issuer, generators, type Client, type IssuerMetadata, type TokenSet } from 'openid-client';
import { parseEnv, type AppConfig } from '../infra/config/env';

/** Scope xin từ PMH ID. `offline_access` để có refresh_token; `groups` để suy vai trò/phòng ban. */
const SCOPE = 'openid email profile groups offline_access';

/** Tham số một lượt đăng nhập, giữ tạm ở cookie đã ký cho tới khi callback. */
export interface LoginTransaction {
  state: string;
  nonce: string;
  codeVerifier: string;
}

export interface OidcClaims {
  sub: string;
  email: string | null;
  name: string | null;
  employeeCode: string | null;
  /**
   * Phòng ban do PMH ID khai thẳng trong token (`claims_supported` có `department`).
   * Đáng tin hơn suy từ `groups`: không phụ thuộc việc tên nhóm ở PMH ID có khớp
   * `VPP_DEPARTMENT_GROUPS` hay không. `null` khi IdP không phát claim này.
   */
  department: string | null;
  groups: string[];
}

/**
 * Bọc `openid-client` — DE-VPP là confidential client theo mẫu BFF:
 * token OIDC ở server, trình duyệt chỉ giữ cookie phiên (SSO-INTEGRATION §2).
 */
@Injectable()
export class OidcService {
  private readonly logger = new Logger(OidcService.name);
  private readonly config: AppConfig = parseEnv();
  private clientPromise: Promise<Client> | null = null;
  private jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

  get redirectUri(): string {
    return `${this.config.APP_BASE_URL}/api/auth/callback`;
  }

  /**
   * Discovery được thực hiện LƯỜI và nhớ lại kết quả: api khởi động được cả khi IdP
   * chưa sẵn sàng (thứ tự container), chỉ luồng đăng nhập mới cần IdP sống.
   */
  private async getClient(): Promise<Client> {
    this.clientPromise ??= this.discoverIssuer()
      .then((issuer) => {
        this.logger.log(`Đã discovery IdP: ${issuer.issuer}`);
        return new issuer.Client({
          client_id: this.config.PMH_CLIENT_ID,
          client_secret: this.config.PMH_CLIENT_SECRET,
          redirect_uris: [this.redirectUri],
          response_types: ['code'],
        });
      })
      .catch((error: unknown) => {
        this.clientPromise = null; // cho phép thử lại ở request sau
        throw error;
      });
    return this.clientPromise;
  }

  /**
   * Đọc discovery document rồi dựng Issuer.
   *
   * Khi khai `OIDC_INTERNAL_ISSUER`, các endpoint api gọi TRỰC TIẾP được đổi sang URL
   * nội bộ, còn `issuer` và các endpoint TRÌNH DUYỆT dùng (`authorization_endpoint`,
   * `end_session_endpoint`) giữ nguyên URL công khai — nếu đổi cả thì `iss` trong
   * token sẽ không khớp và trình duyệt bị đẩy tới địa chỉ nó không tới được.
   */
  private async discoverIssuer(): Promise<Issuer> {
    const publicIssuer = this.config.OIDC_ISSUER.replace(/\/$/, '');
    const internalIssuer = (this.config.OIDC_INTERNAL_ISSUER || publicIssuer).replace(/\/$/, '');

    if (internalIssuer === publicIssuer) return Issuer.discover(publicIssuer);

    const response = await fetch(`${internalIssuer}/.well-known/openid-configuration`);
    if (!response.ok) {
      throw new Error(`Discovery IdP thất bại (${response.status}) tại ${internalIssuer}`);
    }
    const metadata = (await response.json()) as IssuerMetadata;

    /** Endpoint api gọi TRỰC TIẾP (không qua trình duyệt). */
    const SERVER_SIDE_ENDPOINTS = [
      'token_endpoint',
      'jwks_uri',
      'userinfo_endpoint',
      'introspection_endpoint',
      'revocation_endpoint',
    ] as const;

    const swapPrefix = (value: string, from: string, to: string): string =>
      value.startsWith(from) ? to + value.slice(from.length) : value;

    // IdP sinh endpoint theo `Host` của request, nên hỏi qua URL nội bộ thì MỌI endpoint
    // trả về đều là URL nội bộ (riêng `issuer` giữ giá trị đã cấu hình).
    // Bước 1: đưa tất cả về URL công khai — mặc định an toàn cho trình duyệt.
    const rewritten: IssuerMetadata = { ...metadata };
    for (const [key, value] of Object.entries(rewritten)) {
      if (typeof value === 'string' && key !== 'issuer') {
        rewritten[key] = swapPrefix(value, internalIssuer, publicIssuer);
      }
    }
    // Bước 2: chỉ những endpoint api tự gọi mới quay lại URL nội bộ.
    for (const key of SERVER_SIDE_ENDPOINTS) {
      const value = rewritten[key];
      if (typeof value === 'string') {
        rewritten[key] = swapPrefix(value, publicIssuer, internalIssuer);
      }
    }

    this.logger.log(`IdP: issuer công khai ${publicIssuer}, gọi nội bộ qua ${internalIssuer}`);
    return new Issuer(rewritten);
  }

  /** Sinh state/nonce/PKCE và URL `/authorize` để chuyển hướng trình duyệt sang IdP. */
  async createAuthorizationUrl(): Promise<{ url: string; transaction: LoginTransaction }> {
    const client = await this.getClient();
    const transaction: LoginTransaction = {
      state: generators.state(),
      nonce: generators.nonce(),
      codeVerifier: generators.codeVerifier(),
    };
    const url = client.authorizationUrl({
      scope: SCOPE,
      state: transaction.state,
      nonce: transaction.nonce,
      code_challenge: generators.codeChallenge(transaction.codeVerifier),
      code_challenge_method: 'S256',
      // KHÔNG gửi `prompt=consent`. Theo OIDC Core thì đó là cách xin
      // `offline_access`, nhưng PMH ID **cố ý bỏ màn consent** (mọi client là
      // first-party nội bộ) và tự cấp Grant đủ scope trong `loadExistingGrant`
      // — xem `apps/sso-server/src/oidc/provider.factory.ts` của PMH ID.
      // Gửi `prompt=consent` là ép provider đòi một màn hình KHÔNG TỒN TẠI:
      // đăng nhập đúng xong, Portal lại hiện form đăng nhập, lặp vô tận.
      // Refresh token vẫn có vì Grant tự sinh đã gồm nguyên scope app xin.
    });
    return { url, transaction };
  }

  /** Đổi `code` lấy token. Thư viện tự kiểm state/nonce/PKCE và verify id_token. */
  async exchangeCode(
    callbackParams: Record<string, string>,
    transaction: LoginTransaction,
  ): Promise<TokenSet> {
    const client = await this.getClient();
    return client.callback(this.redirectUri, callbackParams, {
      state: transaction.state,
      nonce: transaction.nonce,
      code_verifier: transaction.codeVerifier,
    });
  }

  /** Xin access token mới. Ném lỗi ⇒ phiên phải bị huỷ (SSO-INTEGRATION §11). */
  async refresh(refreshToken: string): Promise<TokenSet> {
    const client = await this.getClient();
    return client.refresh(refreshToken);
  }

  /**
   * URL đăng xuất TOÀN HỆ ở IdP (`end_session` + `id_token_hint`).
   *
   * `post_logout_redirect_uri` chỉ được gửi khi IdP đã đăng ký URL đó. Gửi một URL
   * chưa đăng ký thì IdP từ chối NGUYÊN lượt đăng xuất — người dùng mắc ở trang lỗi
   * của IdP thay vì về app. Đặt `OIDC_POST_LOGOUT_REDIRECT=off` để bỏ tham số này.
   */
  async endSessionUrl(idToken: string | null): Promise<string> {
    const client = await this.getClient();
    const configured = this.config.OIDC_POST_LOGOUT_REDIRECT.trim();
    const postLogout =
      configured === 'off' ? undefined : configured || `${this.config.APP_BASE_URL}/`;
    return client.endSessionUrl({
      id_token_hint: idToken ?? undefined,
      post_logout_redirect_uri: postLogout,
    });
  }

  /**
   * Verify `logout_token` của Back-Channel Logout bằng chữ ký IdP.
   * JWKS lấy từ xa và cache tối đa 10 phút (SSO-INTEGRATION §11).
   */
  async verifyLogoutToken(logoutToken: string): Promise<JWTPayload> {
    const client = await this.getClient();
    const jwksUri = client.issuer.metadata.jwks_uri;
    if (!jwksUri) throw new Error('IdP không công bố jwks_uri');

    this.jwks ??= createRemoteJWKSet(new URL(jwksUri), {
      cacheMaxAge: 10 * 60 * 1000,
      cooldownDuration: 30 * 1000,
    });

    const { payload } = await jwtVerify(logoutToken, this.jwks, {
      issuer: client.issuer.metadata.issuer,
      audience: this.config.PMH_CLIENT_ID,
    });

    // Bắt buộc theo spec: phải có claim `events` của backchannel-logout và KHÔNG có `nonce`.
    const events = payload.events as Record<string, unknown> | undefined;
    if (!events?.['http://schemas.openid.net/event/backchannel-logout']) {
      throw new Error('logout_token thiếu claim events backchannel-logout');
    }
    if ('nonce' in payload) throw new Error('logout_token không được có nonce');
    if (!payload.sub && !payload.sid) throw new Error('logout_token thiếu sub/sid');

    return payload;
  }

  /** Rút claim cần dùng từ id_token, chấp nhận vài cách đặt tên khác nhau của IdP. */
  extractClaims(tokenSet: TokenSet): OidcClaims {
    const claims = tokenSet.claims() as Record<string, unknown>;
    const rawGroups = claims.groups;
    return {
      sub: String(claims.sub),
      email: typeof claims.email === 'string' ? claims.email : null,
      name:
        (typeof claims.full_name === 'string' ? claims.full_name : null) ??
        (typeof claims.name === 'string' ? claims.name : null),
      employeeCode: typeof claims.employee_code === 'string' ? claims.employee_code : null,
      // Chuỗi rỗng/toàn khoảng trắng coi như không có, để không ghi đè phần suy từ groups.
      department:
        typeof claims.department === 'string' && claims.department.trim()
          ? claims.department.trim()
          : null,
      groups: Array.isArray(rawGroups)
        ? rawGroups.filter((g): g is string => typeof g === 'string')
        : [],
    };
  }
}
