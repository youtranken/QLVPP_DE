// Tài khoản thử local: CHỈ cho dev khi IdP dev không dùng được. Bật khi AUTH_DEV_MODE=true và NODE_ENV
// thuộc allowlist dev/test (cùng luật dev-identity); đặt biến ở môi trường khác → từ chối khởi động.
// Lỗi không bao giờ chép giá trị biến (chứa hash).
import { isDevAuthActive, TEAM_MAX } from './auth-env';
import type { EnvLike } from './auth-env';

export const LOCAL_TEST_SUB_PREFIX = 'local-test-';
const ALLOWED_ENVS = ['development', 'test'];
const HASH_PATTERN = /^scrypt\.[0-9a-f]+\.[0-9a-f]+$/i;
const ROLES = ['admin', 'member'] as const;

export type LocalTestRole = (typeof ROLES)[number];

export interface LocalTestAccount {
  username: string;
  passwordHash: string;
  role: LocalTestRole;
  sub: string;
  name: string;
  email: string | null;
  department: string | null;
  team: string | null;
}

function raw(env: EnvLike): string {
  return (env.LOCAL_TEST_ACCOUNTS ?? '').trim();
}

function fail(reason: string): never {
  throw new Error(
    `LOCAL_TEST_ACCOUNTS sai: ${reason}. Từ chối khởi động (fail-closed).`,
  );
}

function text(v: unknown, field: string, i: number, max: number): string {
  const s = typeof v === 'string' ? v.trim() : '';
  if (!s || s.length > max) fail(`phần tử ${i} thiếu/quá dài "${field}"`);
  return s;
}

function optional(
  v: unknown,
  field: string,
  i: number,
  max = 200,
): string | null {
  if (v === undefined || v === null || v === '') return null;
  return text(v, field, i, max);
}

function toAccount(item: unknown, i: number): LocalTestAccount {
  if (typeof item !== 'object' || item === null)
    fail(`phần tử ${i} không phải object`);
  const o = item as Record<string, unknown>;
  const passwordHash =
    typeof o.password_hash === 'string' ? o.password_hash.trim() : '';
  if (!HASH_PATTERN.test(passwordHash)) {
    fail(
      `phần tử ${i}: password_hash phải là scrypt.<saltHex>.<hashHex> (npm run local-test:hash)`,
    );
  }
  if (!(ROLES as readonly unknown[]).includes(o.role)) {
    fail(`phần tử ${i}: role phải là admin hoặc member`);
  }
  const sub = text(o.sub, 'sub', i, 100);
  // Tiền tố riêng: không trùng sub PMH ID thật, directory sync không bao giờ chạm tới
  if (
    !sub.startsWith(LOCAL_TEST_SUB_PREFIX) ||
    sub.length === LOCAL_TEST_SUB_PREFIX.length
  ) {
    fail(`phần tử ${i}: sub phải bắt đầu bằng "${LOCAL_TEST_SUB_PREFIX}"`);
  }
  return {
    username: text(o.username, 'username', i, 200),
    passwordHash,
    role: o.role as LocalTestRole,
    sub,
    name: text(o.name, 'name', i, 200),
    email: optional(o.email, 'email', i),
    department: optional(o.department, 'department', i),
    team: optional(o.team, 'team', i, TEAM_MAX),
  };
}

function parseStrict(value: string): LocalTestAccount[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    fail('không phải JSON hợp lệ');
  }
  if (!Array.isArray(parsed) || parsed.length === 0)
    fail('phải là mảng JSON khác rỗng');
  const accounts = parsed.map(toAccount);
  for (const key of ['username', 'sub'] as const) {
    if (new Set(accounts.map((a) => a[key])).size !== accounts.length)
      fail(`trùng ${key}`);
  }
  return accounts;
}

export function parseLocalTestAccounts(
  env: EnvLike,
): LocalTestAccount[] | null {
  const value = raw(env);
  if (!value || !isDevAuthActive(env)) return null;
  return parseStrict(value);
}

export function assertLocalTestAccountsSafe(env: EnvLike): void {
  if (!raw(env)) return;
  if (!ALLOWED_ENVS.includes(env.NODE_ENV ?? '')) {
    throw new Error(
      `LOCAL_TEST_ACCOUNTS chỉ dành cho dev (NODE_ENV thuộc [${ALLOWED_ENVS.join(', ')}]); ` +
        `NODE_ENV hiện tại: ${JSON.stringify(env.NODE_ENV ?? null)}. Từ chối khởi động (fail-closed).`,
    );
  }
  parseLocalTestAccounts(env);
}
