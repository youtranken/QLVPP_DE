import { calculateJwkThumbprint, exportJWK, generateKeyPair } from 'jose';
import Provider, { type Configuration } from 'oidc-provider';
import {
  BACKCHANNEL_LOGOUT_URI,
  CLIENT_ID,
  CLIENT_SECRET,
  ISSUER,
  M2M_CLIENT_ID,
  M2M_CLIENT_SECRET,
  REDIRECT_URI,
  APP_BASE_URL,
} from './config';
import { findDemoUser } from './users';

/**
 * Khoá ký sinh MỚI mỗi lần khởi động — cố tình không lưu ra file để repo không
 * chứa private key. Khởi động lại IdP ⇒ token cũ hết hiệu lực (chấp nhận được cho demo).
 *
 * `kid` PHẢI là thumbprint của chính khoá, không được đặt cố định: client cache JWKS
 * theo `kid`, nên `kid` trùng với khoá đã đổi sẽ khiến client dùng mãi khoá cũ và
 * verify id_token luôn thất bại sau mỗi lần restart IdP.
 */
async function generateJwks(): Promise<Configuration['jwks']> {
  const { privateKey } = await generateKeyPair('RS256', { extractable: true });
  const jwk = await exportJWK(privateKey);
  const kid = await calculateJwkThumbprint(jwk);
  return { keys: [{ ...jwk, kid, use: 'sig', alg: 'RS256' }] };
}

export async function createProvider(): Promise<Provider> {
  const configuration: Configuration = {
    jwks: await generateJwks(),

    clients: [
      {
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_types: ['authorization_code', 'refresh_token'],
        response_types: ['code'],
        redirect_uris: [REDIRECT_URI],
        post_logout_redirect_uris: [`${APP_BASE_URL}/`],
        backchannel_logout_uri: BACKCHANNEL_LOGOUT_URI,
        backchannel_logout_session_required: false,
        token_endpoint_auth_method: 'client_secret_basic',
      },
      {
        // Directory API (M2M) — chỉ client_credentials, không đăng nhập người dùng.
        client_id: M2M_CLIENT_ID,
        client_secret: M2M_CLIENT_SECRET,
        grant_types: ['client_credentials'],
        response_types: [],
        redirect_uris: [],
        token_endpoint_auth_method: 'client_secret_basic',
      },
    ],

    scopes: ['openid', 'offline_access', 'email', 'profile', 'groups'],

    claims: {
      openid: ['sub'],
      email: ['email', 'email_verified'],
      profile: ['name', 'full_name', 'employee_code'],
      groups: ['groups'],
    },

    /** Trả claim ngay trong id_token để api không phải gọi thêm /userinfo. */
    conformIdTokenClaims: false,

    async findAccount(_ctx, sub) {
      const user = findDemoUser(sub);
      if (!user) return undefined;
      return {
        accountId: sub,
        claims: () => ({
          sub,
          email: user.email,
          email_verified: true,
          name: user.full_name,
          full_name: user.full_name,
          employee_code: user.employee_code,
          groups: user.groups,
        }),
      };
    },

    features: {
      devInteractions: { enabled: false }, // dùng trang chọn user riêng ở interaction.ts
      clientCredentials: { enabled: true },
      backchannelLogout: { enabled: true },
      rpInitiatedLogout: { enabled: true },
      revocation: { enabled: true },
      introspection: { enabled: true },
    },

    /** PKCE S256 bắt buộc — khớp yêu cầu bảo mật ở SSO-INTEGRATION §11. */
    pkce: { required: () => true },

    interactions: {
      url: (_ctx, interaction) => `/interaction/${interaction.uid}`,
    },

    cookies: {
      keys: ['mock-idp-cookie-key-demo-only'],
    },

    /**
     * oidc-provider chặn mọi request ra "special-use IP" để chống SSRF — mà RP khi
     * dev/demo lại chính là `localhost`, nên back-channel logout không bao giờ tới nơi.
     * Provider gắn sẵn một `dispatcher` có lớp chặn vào options, nên phải BỎ dispatcher
     * đó đi thì fetch mới đi được. CHẤP NHẬN ĐƯỢC vì đây là IdP giả chỉ chạy local;
     * PMH ID thật giữ nguyên lớp bảo vệ của nó.
     */
    fetch: (url, options) => {
      const { dispatcher: _ssrfGuardedDispatcher, ...rest } = (options ?? {}) as RequestInit & {
        dispatcher?: unknown;
      };
      return globalThis.fetch(url, rest);
    },

    ttl: {
      Session: 7 * 24 * 60 * 60,
      AccessToken: 10 * 60, // ngắn có chủ ý: để thấy luồng refresh token hoạt động
      IdToken: 10 * 60,
      Grant: 7 * 24 * 60 * 60,
      Interaction: 10 * 60,
    },
  };

  return new Provider(ISSUER, configuration);
}
