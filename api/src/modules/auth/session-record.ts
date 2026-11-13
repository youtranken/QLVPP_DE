import type { PmhIdClaims } from '../users/users.service';
import { openToken } from './session-crypto';
import type { sessionsTable } from './sessions.schema';

// Phiên app tối đa 12 h kể từ lúc đăng nhập (chuẩn phiên chung PMH ID), kể cả SA/tài khoản thử.
// Còn hiệu lực khi now < expires_at; now ≥ expires_at là hết.
export const SESSION_MAX_AGE_MS = 12 * 60 * 60 * 1000;

// Lý do kết thúc phiên theo chuẩn phiên chung (nhật ký auth.session_expired)
export type SessionEndReason =
  'idle' | 'absolute' | 'revoked' | 'refresh_failed';

export interface SessionRecord {
  // Cookie vpp_sid thô (create trả về để set cookie; find trả lại đúng cookie đã tra) — không lưu DB
  id: string;
  userSub: string;
  refreshToken: string | null;
  accessToken: string | null;
  accessTokenExp: Date | null;
  claims: PmhIdClaims | null;
  csrfToken: string;
  idToken: string | null;
  lastSeenAt: Date;
  expiresAt: Date;
}

type SessionRow = typeof sessionsTable.$inferSelect;

// Token chỉ giải mã khi có người đọc (refresh cần refreshToken, switch-account cần idToken…)
function lazy(sealed: string | null, idHash: string): () => string | null {
  let opened: { v: string | null } | undefined;
  return () => (opened ??= { v: openToken(sealed, idHash) }).v;
}

export function toSessionRecord(
  cookie: string,
  row: SessionRow,
): SessionRecord {
  const refresh = lazy(row.refreshToken, row.idHash);
  const access = lazy(row.accessToken, row.idHash);
  const id = lazy(row.idToken, row.idHash);
  return {
    id: cookie,
    userSub: row.userSub,
    get refreshToken() {
      return refresh();
    },
    get accessToken() {
      return access();
    },
    accessTokenExp: row.accessTokenExp,
    claims: row.claims as PmhIdClaims | null,
    csrfToken: row.csrfToken,
    get idToken() {
      return id();
    },
    lastSeenAt: row.lastSeenAt,
    expiresAt: row.expiresAt,
  };
}

// Production không chấp nhận token 'p:' (nguyên văn): coi cả phiên là không hợp lệ
export function hasPlainTokenInProduction(row: SessionRow): boolean {
  return (
    process.env.NODE_ENV === 'production' &&
    [row.refreshToken, row.accessToken, row.idToken].some((t) =>
      t?.startsWith('p:'),
    )
  );
}
