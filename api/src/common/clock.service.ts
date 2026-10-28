import { Injectable } from '@nestjs/common';
import type { EnvLike } from '../modules/auth/auth-env';

// Offset chỉ để e2e/Playwright giả lập ngày; lọt ra prod thì hạn kỳ sai cho cả phòng
export function assertClockEnv(env: EnvLike): void {
  if (env.CLOCK_OFFSET_MS !== undefined && env.NODE_ENV !== 'test') {
    throw new Error(
      `CLOCK_OFFSET_MS chỉ được đặt khi NODE_ENV=test (đang là ${JSON.stringify(env.NODE_ENV ?? null)}). Từ chối khởi động.`,
    );
  }
}

@Injectable()
export class ClockService {
  private readonly offsetMs: number;

  constructor(env: EnvLike) {
    const raw = env.NODE_ENV === 'test' ? (env.CLOCK_OFFSET_MS ?? '') : '';
    const offset = raw === '' ? 0 : Number(raw);
    // Offset gõ sai mà lặng lẽ thành 0 thì e2e chạy với ngày thật và xanh nhầm
    if (!Number.isFinite(offset)) {
      throw new Error(
        `CLOCK_OFFSET_MS phải là số mili giây (đang là ${JSON.stringify(raw)}).`,
      );
    }
    this.offsetMs = offset;
  }

  now(): Date {
    return new Date(Date.now() + this.offsetMs);
  }
}
