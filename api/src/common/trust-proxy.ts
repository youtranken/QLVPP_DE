import type { EnvLike } from '../modules/auth/auth-env';

const MAX_HOPS = 5;

// Sai số hop thì req.ip là IP proxy — mọi giới hạn theo IP (SA lockout, throttler) gộp làm một
export function assertTrustProxyHops(env: EnvLike): number {
  const raw = env.TRUST_PROXY_HOPS;
  if (raw === undefined || !/^\d+$/.test(raw) || Number(raw) > MAX_HOPS) {
    throw new Error(
      `TRUST_PROXY_HOPS phải là số nguyên 0–${MAX_HOPS} (prod sau EDGE = 2, dev = 1); ` +
        `đang là ${JSON.stringify(raw ?? null)}. Từ chối khởi động.`,
    );
  }
  return Number(raw);
}
