import type { EnvLike } from '../modules/auth/auth-env';

const DEFAULT_PER_MIN = 300;
const MAX_PER_MIN = 100_000;

type ThrottleEnv = 'THROTTLE_USER_PER_MIN' | 'THROTTLE_IP_PER_MIN';

// Number('-1') || 300 = -1, Number('0') || 300 = 300 → âm/sai im lặng tắt hoặc đổi giới hạn; từ chối khởi động thay vì đoán
export function throttlePerMin(env: EnvLike, name: ThrottleEnv): number {
  const raw = env[name];
  if (raw === undefined || raw === '') return DEFAULT_PER_MIN;
  if (!/^[1-9]\d*$/.test(raw) || Number(raw) > MAX_PER_MIN) {
    throw new Error(
      `${name} phải là số nguyên 1–${MAX_PER_MIN} (mặc định ${DEFAULT_PER_MIN}); ` +
        `đang là ${JSON.stringify(raw)}. Từ chối khởi động.`,
    );
  }
  return Number(raw);
}
