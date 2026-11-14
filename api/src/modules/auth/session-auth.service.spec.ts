import { ServiceUnavailableException } from '@nestjs/common';
import { makeService } from './session-auth.fixture-spec';
import { TokenContractError } from './token-contract.error';

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

  it('refresh bị TỪ CHỐI (invalid_grant) → hủy phiên lý do revoked', async () => {
    const err = Object.assign(new Error('grant fail'), {
      error: 'invalid_grant',
    });
    const { service, sessions } = makeService({
      refreshImpl: jest.fn().mockRejectedValue(err),
    });
    const result = await service.resolve('sid-1');
    expect(result).toBeNull();
    expect(sessions.expire).toHaveBeenCalledWith('sid-1', 'revoked');
  });

  it('PMH ID SẬP (lỗi mạng) → GIỮ phiên, ném 503 SSO_UNAVAILABLE — không logout oan', async () => {
    const { service, sessions } = makeService({
      refreshImpl: jest.fn().mockRejectedValue(new TypeError('fetch failed')),
    });
    await expect(service.resolve('sid-1')).rejects.toThrow(
      ServiceUnavailableException,
    );
    expect(sessions.expire).not.toHaveBeenCalled();
    await expect(service.resolve('sid-1')).rejects.toMatchObject({
      response: {
        code: 'SSO_UNAVAILABLE',
        message: 'Không kết nối được Tài khoản D&E — vui lòng thử lại sau.',
      },
    });
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
    expect(sessions.expire).not.toHaveBeenCalled();
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
});

describe('SessionAuthService — refresh ghi vai từ app_role (đổi trong DB IdP không phát webhook)', () => {
  it('refresh mang app_role admin cho user đang member → applyRole(sub,"admin","refresh") và identity admin', async () => {
    const { service, users } = makeService({ refreshedAppRole: 'admin' });
    const result = await service.resolve('sid-1');
    expect(users.applyRole).toHaveBeenCalledWith('usr_1', 'admin', 'refresh');
    expect(result?.role).toBe('admin');
  });

  it('refresh mang app_role member cho user đang admin → applyRole(sub,"member","refresh") và identity member', async () => {
    const { service, users } = makeService({
      userRole: 'admin',
      refreshedAppRole: 'member',
    });
    const result = await service.resolve('sid-1');
    expect(users.applyRole).toHaveBeenCalledWith('usr_1', 'member', 'refresh');
    expect(result?.role).toBe('member');
  });

  it('refresh thiếu app_role (hoặc "ADMIN") → member (fail-closed)', async () => {
    const { service, users } = makeService({
      userRole: 'admin',
      refreshedAppRole: 'ADMIN',
    });
    expect((await service.resolve('sid-1'))?.role).toBe('member');
    expect(users.applyRole).toHaveBeenCalledWith('usr_1', 'member', 'refresh');
  });

  it('token còn hạn → không gọi applyRole (vai đã có trong DB)', async () => {
    const { service, users } = makeService({
      session: { accessTokenExp: new Date(Date.now() + 60_000) },
    });
    await service.resolve('sid-1');
    expect(users.applyRole).not.toHaveBeenCalled();
  });

  it('refresh ném TokenContractError → hủy phiên lý do revoked (cause token_ver), trả null (không 503)', async () => {
    const { service, sessions, users } = makeService({
      verifyImpl: jest.fn().mockRejectedValue(new TokenContractError(2)),
    });
    expect(await service.resolve('sid-1')).toBeNull();
    expect(sessions.expire).toHaveBeenCalledWith(
      'sid-1',
      'revoked',
      'token_ver',
    );
    expect(sessions.updateTokens).not.toHaveBeenCalled();
    expect(users.applyRole).not.toHaveBeenCalled();
  });
});

describe('SessionAuthService — refreshNow (lưu ngôn ngữ PMH ID)', () => {
  it('token còn hạn vẫn refresh; lưu access token mới; trả phiên đọc lại', async () => {
    const { service, oidc, sessions } = makeService({
      session: { accessTokenExp: new Date(Date.now() + 60_000) },
    });
    const result = await service.refreshNow('sid-1');
    expect(oidc.refresh).toHaveBeenCalledTimes(1);
    expect(sessions.updateTokens).toHaveBeenCalledWith(
      'sid-1',
      expect.objectContaining({ accessToken: 'jwt-moi', refreshToken: 'rt-2' }),
    );
    expect(result?.id).toBe('sid-1');
  });

  it('chạy cùng lúc với refresh của resolve() → dùng chung MỘT lượt refresh', async () => {
    let resolveRefresh!: (v: unknown) => void;
    const refreshImpl = jest.fn().mockReturnValue(
      new Promise((r) => {
        resolveRefresh = r;
      }),
    );
    const { service, oidc } = makeService({ refreshImpl });
    const a = service.resolve('sid-1');
    const b = service.refreshNow('sid-1');
    await new Promise((r) => setImmediate(r));
    resolveRefresh({ accessToken: 'jwt-moi', refreshToken: 'rt-2' });
    await Promise.all([a, b]);
    expect(oidc.refresh).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['SA local', { userSub: 'local:sa', claims: null }],
    ['tài khoản thử dev', { userSub: 'local-test-an' }],
  ])('%s → null, không gọi PMH ID', async (_n, session) => {
    const { service, oidc } = makeService({
      session: session,
    });
    await expect(service.refreshNow('sid-1')).resolves.toBeNull();
    expect(oidc.refresh).not.toHaveBeenCalled();
  });

  it('PMH ID từ chối (invalid_grant) → null, phiên bị hủy', async () => {
    const { service, sessions } = makeService({
      refreshImpl: jest
        .fn()
        .mockRejectedValue(
          Object.assign(new Error('x'), { error: 'invalid_grant' }),
        ),
    });
    await expect(service.refreshNow('sid-1')).resolves.toBeNull();
    expect(sessions.expire).toHaveBeenCalledWith('sid-1', 'revoked');
  });

  it('phiên vừa bị xóa (logout/back-channel) giữa lúc đọc và refresh → null, KHÔNG gọi PMH ID bằng refresh token cũ', async () => {
    const { service, sessions, oidc } = makeService({
      session: { accessTokenExp: new Date(Date.now() + 60_000) },
    });
    // lần đọc thứ nhất (refreshNow) còn phiên; lần đọc lại trong doRefreshTokens đã mất
    const original = await sessions.find('sid-1');
    sessions.find.mockReset();
    sessions.find.mockResolvedValueOnce(original).mockResolvedValue(null);
    await expect(service.refreshNow('sid-1')).resolves.toBeNull();
    expect(oidc.refresh).not.toHaveBeenCalled();
    expect(sessions.updateTokens).not.toHaveBeenCalled();
  });

  it('PMH ID treo → refresh hết thời gian (TimeoutError) xử như lỗi mạng: ném 503, GIỮ phiên', async () => {
    const { service, sessions } = makeService({
      refreshImpl: jest
        .fn()
        .mockRejectedValue(
          new DOMException(
            'The operation was aborted due to timeout',
            'TimeoutError',
          ),
        ),
    });
    await expect(service.refreshNow('sid-1')).rejects.toThrow(
      ServiceUnavailableException,
    );
    expect(sessions.expire).not.toHaveBeenCalled();
  });
});
