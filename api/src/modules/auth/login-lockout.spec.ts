import { GLOBAL_MAX, IP_MAX, LoginLockout } from './login-lockout';

describe('LoginLockout', () => {
  it(`theo IP: ${IP_MAX - 1} lần sai với các tên khác nhau chưa khóa; lần thứ ${IP_MAX} khóa cả tên chưa sai lần nào; IP khác không bị`, () => {
    const l = new LoginLockout();
    for (let i = 1; i < IP_MAX; i++) l.recordFailure('1.1.1.1', `u${i}`);
    expect(l.isLocked('1.1.1.1', 'moi')).toBe(false);
    l.recordFailure('1.1.1.1', 'u-last');
    expect(l.isLocked('1.1.1.1', 'moi')).toBe(true);
    expect(l.isLocked('2.2.2.2', 'moi')).toBe(false);
  });

  it(`toàn cục: báo onGlobalLock đúng một lần khi lần sai thứ ${GLOBAL_MAX} chạm trần`, () => {
    const onGlobalLock = jest.fn();
    const l = new LoginLockout(onGlobalLock);
    for (let i = 1; i < GLOBAL_MAX; i++) l.recordFailure(`10.0.${i}.1`, 'x');
    expect(onGlobalLock).not.toHaveBeenCalled();
    expect(l.isLocked('10.9.9.9', 'y')).toBe(false);
    l.recordFailure('10.0.200.1', 'x');
    expect(onGlobalLock).toHaveBeenCalledTimes(1);
    l.recordFailure('10.0.201.1', 'x');
    expect(onGlobalLock).toHaveBeenCalledTimes(1);
    expect(l.isLocked('10.9.9.9', 'y')).toBe(true);
  });
});
