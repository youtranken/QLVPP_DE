// SA chỉ đến từ env (DB bị xâm nhập không tạo được SA). Hash dùng '.' vì compose diễn giải '$'.
import type { EnvLike } from './auth-env';

export const LOCAL_SA_SUB = 'local:sa';
export const LOCAL_SA_FULL_NAME = 'SSA (nội bộ)';
export const LOCAL_SA_EMAIL = 'ssa@local.com';
export const LOCAL_SA_IDLE_MS = 2 * 60 * 60 * 1000;

export interface LocalSaConfig {
  username: string;
  passwordHash: string;
}

const HASH_PATTERN = /^scrypt\.[0-9a-f]+\.[0-9a-f]+$/i;

export function parseLocalSa(env: EnvLike): LocalSaConfig | null {
  const username = (env.LOCAL_SA_USERNAME ?? '').trim();
  const passwordHash = (env.LOCAL_SA_PASSWORD_HASH ?? '').trim();
  if (!username || !HASH_PATTERN.test(passwordHash)) {
    return null;
  }
  return { username, passwordHash };
}

export function assertLocalSaConfigured(env: EnvLike): void {
  const username = (env.LOCAL_SA_USERNAME ?? '').trim();
  const passwordHash = (env.LOCAL_SA_PASSWORD_HASH ?? '').trim();
  if (!username) {
    throw new Error(
      'LOCAL_SA_USERNAME trống — cần tên đăng nhập SA cục bộ (break-glass). ' +
        'Từ chối khởi động (không có cơ chế nâng SA ngầm).',
    );
  }
  if (!HASH_PATTERN.test(passwordHash)) {
    throw new Error(
      'LOCAL_SA_PASSWORD_HASH thiếu/sai định dạng — phải là `scrypt.<saltHex>.<hashHex>` ' +
        '(sinh bằng `npm run sa:hash`). Từ chối khởi động.',
    );
  }
}
