import { makeService } from './session-auth.fixture-spec';

// Phiên kết thúc: SessionService.expire xóa và ghi nhật ký (lý do theo chuẩn phiên chung)
describe('SessionAuthService — chỉ user active mới có phiên', () => {
  const fresh = { accessTokenExp: new Date(Date.now() + 60_000) };

  it.each([['no_access'], ['locked'], ['deleted']])(
    'user status %s → hủy phiên lý do revoked (cause user_inactive), trả null',
    async (status) => {
      const { service, sessions } = makeService({
        session: fresh,
        userStatus: status,
      });
      expect(await service.resolve('sid-1')).toBeNull();
      expect(sessions.expire).toHaveBeenCalledWith(
        'sid-1',
        'revoked',
        'user_inactive',
      );
    },
  );

  it('status active → identity bình thường, không hủy phiên', async () => {
    const { service, sessions } = makeService({ session: fresh });
    expect((await service.resolve('sid-1'))?.sub).toBe('usr_1');
    expect(sessions.expire).not.toHaveBeenCalled();
  });

  it('chưa có users row → hủy phiên lý do revoked (cause user_inactive)', async () => {
    const { service, users, sessions } = makeService({ session: fresh });
    users.findBySub.mockResolvedValue(null);
    expect(await service.resolve('sid-1')).toBeNull();
    expect(sessions.expire).toHaveBeenCalledWith(
      'sid-1',
      'revoked',
      'user_inactive',
    );
  });

  it('refresh xong nhưng user đã no_access → null (refresh không mở lại phiên)', async () => {
    const { service, sessions } = makeService({ userStatus: 'no_access' });
    expect(await service.resolve('sid-1')).toBeNull();
    expect(sessions.expire).toHaveBeenCalledWith(
      'sid-1',
      'revoked',
      'user_inactive',
    );
  });
});

describe('SessionAuthService — trần 12 h (find chỉ trả phiên còn hạn)', () => {
  it('find không thấy phiên → thử xóa nếu đã chạm trần (nhật ký absolute do SessionService ghi), trả null', async () => {
    const { service, sessions } = makeService({ session: null });
    sessions.expireIfPastMaxAge.mockResolvedValue(true);
    expect(await service.resolve('sid-1')).toBeNull();
    expect(sessions.expireIfPastMaxAge).toHaveBeenCalledWith('sid-1');
    expect(sessions.expire).not.toHaveBeenCalled();
  });

  it('phiên còn hạn → không đụng expireIfPastMaxAge', async () => {
    const { service, sessions } = makeService({
      session: { accessTokenExp: new Date(Date.now() + 60_000) },
    });
    expect((await service.resolve('sid-1'))?.sub).toBe('usr_1');
    expect(sessions.expireIfPastMaxAge).not.toHaveBeenCalled();
  });
});

describe('SessionAuthService — SA cục bộ idle 2 giờ', () => {
  const NOW = Date.parse('2026-11-05T03:00:00.000Z');
  const TWO_HOURS = 2 * 60 * 60 * 1000;

  beforeEach(() => jest.spyOn(Date, 'now').mockReturnValue(NOW));
  afterEach(() => jest.restoreAllMocks());

  function saSession(idleMs: number) {
    return makeService({
      session: {
        userSub: 'local:sa',
        claims: null,
        refreshToken: null,
        accessTokenExp: null,
        lastSeenAt: new Date(NOW - idleMs),
        expiresAt: new Date(NOW + 3_600_000),
      },
    });
  }

  it.each([
    ['1:59:59.999', TWO_HOURS - 1],
    ['đúng 2:00:00.000', TWO_HOURS],
  ])(
    'phiên SA idle %s vẫn hợp lệ, vai sa và chạm last_seen',
    async (_label, idle) => {
      const { service, sessions } = saSession(idle);
      const result = await service.resolve('sid-1');
      expect(result).toMatchObject({ sub: 'local:sa', role: 'sa' });
      expect(sessions.touchLastSeen).toHaveBeenCalledWith('sid-1');
      expect(sessions.expire).not.toHaveBeenCalled();
    },
  );

  it('phiên SA idle 2 giờ + 1 ms → null, hủy phiên lý do idle', async () => {
    const { service, sessions } = saSession(TWO_HOURS + 1);
    expect(await service.resolve('sid-1')).toBeNull();
    expect(sessions.expire).toHaveBeenCalledWith('sid-1', 'idle');
    expect(sessions.touchLastSeen).not.toHaveBeenCalled();
  });
});

describe('SessionAuthService — không còn refresh token', () => {
  it('phiên SSO hết hạn access token mà không có refresh token → hủy lý do refresh_failed', async () => {
    const { service, sessions, oidc } = makeService({
      session: { refreshToken: null },
    });
    expect(await service.resolve('sid-1')).toBeNull();
    expect(sessions.expire).toHaveBeenCalledWith(
      'sid-1',
      'refresh_failed',
      'no_refresh_token',
    );
    expect(oidc.refresh).not.toHaveBeenCalled();
  });
});
