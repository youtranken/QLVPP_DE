import { fileURLToPath } from 'node:url';
import { config as loadEnv } from 'dotenv';

/**
 * Cấu hình mock-idp. Đọc CHUNG `.env` ở gốc repo với api để `APP_BASE_URL`,
 * `PMH_CLIENT_ID`… không bao giờ lệch nhau — lệch là redirect_uri không khớp.
 * Biến môi trường thật (docker-compose) luôn thắng file .env.
 */
loadEnv({
  path: fileURLToPath(new URL('../../../.env', import.meta.url)),
  override: false,
  quiet: true,
});

const env = process.env;

export const PORT = Number(env.MOCK_IDP_PORT ?? 9000);

/** Issuer PHẢI khớp OIDC_ISSUER của api. Có hậu tố `/oidc` cho giống PMH ID thật. */
export const ISSUER = env.MOCK_IDP_ISSUER ?? `http://localhost:${PORT}/oidc`;

/** URL công khai của DE-VPP — nơi IdP chuyển hướng về sau khi đăng nhập. */
export const APP_BASE_URL = env.APP_BASE_URL ?? 'http://localhost:8080';

/** Client bí mật của api (authorization_code + refresh_token). */
export const CLIENT_ID = env.PMH_CLIENT_ID ?? 'de-vpp-dev';
export const CLIENT_SECRET = env.PMH_CLIENT_SECRET ?? 'dev-secret-change-me';

/** Client M2M cho Directory API (client_credentials). */
export const M2M_CLIENT_ID = env.PMH_M2M_CLIENT_ID ?? 'de-vpp-dev-m2m';
export const M2M_CLIENT_SECRET = env.PMH_M2M_CLIENT_SECRET ?? 'dev-m2m-secret-change-me';

export const REDIRECT_URI = `${APP_BASE_URL}/api/auth/callback`;
export const BACKCHANNEL_LOGOUT_URI = `${APP_BASE_URL}/api/auth/backchannel-logout`;
