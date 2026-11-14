export const PAIR_MAX = 5;
export const IP_MAX = 10;
export const GLOBAL_MAX = 50;
const WINDOW_MS = 15 * 60 * 1000;
const GLOBAL_KEY = '*';
// Trần cứng: bị bơm cặp (ip, username) ồ ạt thì mất vài bộ đếm còn hơn OOM
const MAX_ENTRIES = 10_000;

// Lockout in-memory, cửa sổ trượt 15′: cặp (ip, username) chống dò một nơi; theo IP gom mọi lần sai của một IP
// (dò tên ở ô đăng nhập + dò mật khẩu dùng chung ngân sách); toàn cục chống dò rải IP.
// Đúng mật khẩu chỉ xóa bộ đếm cặp — bộ đếm IP và toàn cục giữ nguyên để không tự mở khóa cho kẻ dò.
// Mỗi lối đăng nhập (SA, tài khoản thử) giữ một instance riêng: dò bên này không khóa bên kia.
export class LoginLockout {
  private readonly failures = new Map<string, number[]>();

  // onGlobalLock: gọi một lần mỗi khi bộ đếm toàn cục vừa chạm trần (để ghi log/Nhật ký)
  constructor(private readonly onGlobalLock?: () => void) {}

  // verify luôn được gọi khi chưa khóa để thời gian phản hồi không lộ gì
  attempt(
    ip: string,
    username: string,
    verify: () => boolean,
  ): 'ok' | 'bad' | 'locked' {
    if (this.isLocked(ip, username)) {
      return 'locked';
    }
    if (verify()) {
      this.failures.delete(pairKey(ip, username));
      return 'ok';
    }
    this.recordFailure(ip, username);
    return this.isLocked(ip, username) ? 'locked' : 'bad';
  }

  isLocked(ip: string, username: string): boolean {
    const now = Date.now();
    return (
      this.recent(pairKey(ip, username), now).length >= PAIR_MAX ||
      this.recent(ipKey(ip), now).length >= IP_MAX ||
      this.recent(GLOBAL_KEY, now).length >= GLOBAL_MAX
    );
  }

  recordFailure(ip: string, username: string): void {
    const now = Date.now();
    const globalWasLocked = this.recent(GLOBAL_KEY, now).length >= GLOBAL_MAX;
    this.push(pairKey(ip, username), now, PAIR_MAX);
    this.push(ipKey(ip), now, IP_MAX);
    this.push(GLOBAL_KEY, now, GLOBAL_MAX);
    this.prune(now);
    if (!globalWasLocked && this.recent(GLOBAL_KEY, now).length >= GLOBAL_MAX) {
      this.onGlobalLock?.();
    }
  }

  private recent(key: string, now: number): number[] {
    const stamps = this.failures.get(key);
    if (!stamps) {
      return [];
    }
    const live = stamps.filter((t) => now - t < WINDOW_MS);
    if (live.length === 0) {
      this.failures.delete(key);
    } else if (live.length !== stamps.length) {
      this.failures.set(key, live);
    }
    return live;
  }

  // Chỉ giữ `max` mốc gần nhất: đủ để biết đã chạm ngưỡng trong cửa sổ
  private push(key: string, now: number, max: number): void {
    const live = [...this.recent(key, now), now];
    this.failures.delete(key);
    this.failures.set(key, live.slice(-max));
  }

  private prune(now: number): void {
    if (this.failures.size <= MAX_ENTRIES) {
      return;
    }
    for (const key of this.failures.keys()) {
      if (key !== GLOBAL_KEY) this.recent(key, now);
    }
    // Map giữ thứ tự chèn (push chèn lại cuối) → xóa cặp cũ nhất trước
    for (const key of this.failures.keys()) {
      if (this.failures.size <= MAX_ENTRIES) {
        break;
      }
      if (key !== GLOBAL_KEY) this.failures.delete(key);
    }
  }
}

function pairKey(ip: string, username: string): string {
  return `${ip}|${username}`;
}

function ipKey(ip: string): string {
  return `ip:${ip}`;
}
