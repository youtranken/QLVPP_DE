import { ServiceUnavailableException } from '@nestjs/common';
import { SessionAuthService } from './session-auth.service';
import type { SessionRecord } from './session.service';

function makeService(opts: {
  session?: Partial<SessionRecord> | null;
  refreshImpl?: jest.Mock;
  updateResult?: boolean;
  userRole?: string;
  userStatus?: string;
  verifyImpl?: jest.Mock;
  refreshedAppRole?: string;
}) {
  const session: SessionRecord | null =
    opts.session === null
      ? null
      : {
          id: 'sid-1',
          userSub: 'usr_1',
          refreshToken: 'rt-1',
          accessTokenExp: new Date(Date.now() - 60_000), // hết hạn
          claims: { sub: 'usr_1', full_name: 'Test' },
          csrfToken: 'tok',
          idToken: 'id-token-1',
          lastSeenAt: new Date(),
          ...opts.session,
        };
  const sessions = {
    find: jest.fn().mockResolvedValue(session),
    updateTokens: jest.fn().mockResolvedValue(opts.updateResult ?? true),
    destroy: jest.fn().mockResolvedValue(undefined),
    touchLastSeen: jest.fn().mockResolvedValue(undefined),
  };
  const jwtVerifier = {
    verify: jest.fn().mockResolvedValue({
      claims: { sub: 'usr_1', full_name: 'Test' },
      expiresAt: new Date(Date.now() + 300_000),
    }),
  };
  const oidc = {
    refresh:
      opts.refreshImpl ??
      jest
        .fn()
        .mockResolvedValue({ accessToken: 'jwt-moi', refreshToken: 'rt-2' }),
  };
  const audit = { append: jest.fn().mockResolvedValue(undefined) };
  const userRow = {
    role: opts.userRole ?? 'member',
    status: opts.userStatus ?? 'active',
  };
  const users = {
    findBySub: jest.fn().mockResolvedValue(userRow),
    // applyRole ghi DB thật; ở đây phản ánh vào userRow để toIdentity đọc lại thấy vai mới
    applyRole: jest.fn((_sub: string, role: string) => {
      const changed = userRow.role !== role;
      userRow.role = role;
      return Promise.resolve(changed);
    }),
  };
  const service = new SessionAuthService(
    sessions as never,
    jwtVerifier as never,
    oidc as never,
    audit as never,
    users as never,
    { findBySub: () => null } as never,
  );
  return { service, sessions, oidc, audit, users, userRow, jwtVerifier };
}

describe('SessionAuthService — refresh ngầm', () => {
  it('single-flight: 3 request song song cùng phiên → refresh đúng MỘT lần', async () => {
    let resolveRefresh!: (v: unknown) => void;
    const refreshImpl = jest.fn().mockReturnValue(
      new Promise((r) => {
        resolveRefresh = r;
      }),
    );
    const { service, oidc } = makeService({ refreshImpl });
    const p = Promise.all([
      service.resolve('sid-1'),
      service.resolve('sid-1'),
      service.resolve('sid-1'),
    ]);
    // nhả refresh sau khi cả 3 đã vào
    resolveRefresh({ accessToken: 'jwt-moi', refreshToken: 'rt-2' });
    const results = await p;
    expect(oidc.refresh).toHaveBeenCalledTimes(1);
    expect(results.every((r) => r?.sub === 'usr_1')).toBe(true);
  });

  it('refresh bị TỪ CHỐI (invalid_grant) → hủy phiên + audit session_expired', async () => {
    const err = Object.assign(new Error('grant fail'), {
      error: 'invalid_grant',
    });
    const { service, sessions, audit } = makeService({
      refreshImpl: jest.fn().mockRejectedValue(err),
    });
    const result = await service.resolve('sid-1');
    expect(result).toBeNull();
    expect(sessions.destroy).toHaveBeenCalledWith('sid-1');
    expect(audit.append).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'auth.session_expired' }),
    );
  });

  it('PMH ID SẬP (lỗi mạng) → GIỮ phiên, ném 503 SSO_UNAVAILABLE — không logout oan', async () => {
    const { service, sessions } = makeService({
      refreshImpl: jest.fn().mockRejectedValue(new TypeError('fetch failed')),
    });
    await expect(service.resolve('sid-1')).rejects.toThrow(
      ServiceUnavailableException,
    );
    expect(sessions.destroy).not.toHaveBeenCalled();
  });

  it('provider ném ServiceUnavailable (SSO chưa cấu hình) → rethrow, GIỮ phiên', async () => {
    const { service, sessions } = makeService({
      refreshImpl: jest.fn().mockRejectedValue(
        new ServiceUnavailableException({
          code: 'SSO_UNAVAILABLE',
          message: 'x',
        }),
      ),
    });
    await expect(service.resolve('sid-1')).rejects.toThrow(
      ServiceUnavailableException,
    );
    expect(sessions.destroy).not.toHaveBeenCalled();
  });

  it('updateTokens trả false (webhook đá phiên giữa chừng) → null, không xác thực', async () => {
    const { service } = makeService({ updateResult: false });
    const result = await service.resolve('sid-1');
    expect(result).toBeNull();
  });

  it('token còn hạn → dùng claims trong session, KHÔNG gọi refresh', async () => {
    const { service, oidc } = makeService({
      session: { accessTokenExp: new Date(Date.now() + 60_000) },
    });
    const result = await service.resolve('sid-1');
    expect(result?.sub).toBe('usr_1');
    expect(oidc.refresh).not.toHaveBeenCalled();
  });
});

describe('SessionAuthService — role tính mỗi request từ users.role', () => {
  const fresh = { accessTokenExp: new Date(Date.now() + 60_000) };

  it("users.role='admin' → identity admin", async () => {
    const { service } = makeService({ session: fresh, userRole: 'admin' });
    expect((await service.resolve('sid-1'))?.role).toBe('admin');
  });

  it("UPDATE users SET role='member' → request kế là member, không cần refresh", async () => {
    const { service, oidc, userRow } = makeService({
      session: fresh,
      userRole: 'admin',
    });
    expect((await service.resolve('sid-1'))?.role).toBe('admin');
    userRow.role = 'member';
    expect((await service.resolve('sid-1'))?.role).toBe('member');
    expect(oidc.refresh).not.toHaveBeenCalled();
  });

  it('claims phiên mang app_role admin nhưng users.role member → member (vai đọc DB)', async () => {
    const { service } = makeService({
      session: {
        ...fresh,
        claims: { sub: 'usr_1', app_role: 'admin', ver: 3 },
      },
    });
    expect((await service.resolve('sid-1'))?.role).toBe('member');
  });

  it('chưa có users row → member', async () => {
    const { service, users } = makeService({ session: fresh });
    users.findBySub.mockResolvedValue(null);
    expect((await service.resolve('sid-1'))?.role).toBe('member');
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
      },
    });
  }

  it.each([
    ['1:59:59.999', TWO_HOURS - 1],
    ['đúng 2:00:00.000', TWO_HOURS],
  ])(
    'phiên SA idle %s vẫn hợp lệ, vai sa và chạm last_seen',
    async (_label, idle) => {
      const { service, sessions, audit } = saSession(idle);
      const result = await service.resolve('sid-1');
      expect(result).toMatchObject({ sub: 'local:sa', role: 'sa' });
      expect(sessions.touchLastSeen).toHaveBeenCalledWith('sid-1');
      expect(sessions.destroy).not.toHaveBeenCalled();
      expect(audit.append).not.toHaveBeenCalled();
    },
  );

  it('phiên SA idle 2 giờ + 1 ms → null, hủy phiên, audit session_expired lý do local_sa_idle', async () => {
    const { service, sessions, audit } = saSession(TWO_HOURS + 1);
    expect(await service.resolve('sid-1')).toBeNull();
    expect(sessions.destroy).toHaveBeenCalledWith('sid-1');
    expect(sessions.touchLastSeen).not.toHaveBeenCalled();
    expect(audit.append).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: 'local:sa',
        action: 'auth.session_expired',
        detail: { reason: 'local_sa_idle' },
      }),
    );
  });
});
