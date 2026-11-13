import { ServiceUnavailableException } from '@nestjs/common';
import type { IdpLocaleApi, IdpLocaleResult } from './idp-locale.client';
import type { AppLocale } from './locale';
import { LocaleSyncService } from './locale-sync.service';
import type { SessionRecord } from './session.service';

const session = (over: Partial<SessionRecord> = {}): SessionRecord => ({
  id: 'sid-1',
  userSub: 'usr_1',
  refreshToken: 'rt',
  accessToken: 'at-1',
  accessTokenExp: new Date(Date.now() + 60_000),
  claims: { sub: 'usr_1', locale: 'vi' },
  csrfToken: 'c',
  idToken: null,
  lastSeenAt: new Date(),
  expiresAt: new Date(Date.now() + 3_600_000),
  ...over,
});

// IdP giả: kết quả lần lượt theo hàng đợi; ghi lại token + locale đã gửi. Không ra mạng.
function fakeIdp(results: Array<IdpLocaleResult | Promise<IdpLocaleResult>>) {
  const calls: Array<{ token: string; locale: AppLocale; userIp?: string }> =
    [];
  const api: IdpLocaleApi = {
    putLocale: (token, locale, opts) => {
      calls.push({ token, locale, userIp: opts?.userIp });
      const next = results.shift() ?? { ok: true, locale };
      return Promise.resolve(next);
    },
  };
  return { api, calls };
}

function makeService(
  idp: IdpLocaleApi,
  opts: {
    current?: SessionRecord | null;
    refreshed?: SessionRecord | null;
    refreshImpl?: jest.Mock;
  } = {},
) {
  const sessions = {
    find: jest
      .fn()
      .mockResolvedValue(opts.current === undefined ? session() : opts.current),
    setSessionLocale: jest.fn().mockResolvedValue(undefined),
  };
  const sessionAuth = {
    refreshNow:
      opts.refreshImpl ??
      jest
        .fn()
        .mockResolvedValue(
          opts.refreshed === undefined
            ? session({ accessToken: 'at-2' })
            : opts.refreshed,
        ),
  };
  const service = new LocaleSyncService(
    sessions as never,
    sessionAuth as never,
    idp,
  );
  return { service, sessions, sessionAuth };
}

describe('LocaleSyncService (docs 7a)', () => {
  it('200 → saved:true; gửi access token phiên + IP; ghi locale vào claims phiên; refresh MỘT lần sau khi lưu', async () => {
    const idp = fakeIdp([{ ok: true, locale: 'en' }]);
    const { service, sessions, sessionAuth } = makeService(idp.api);
    await expect(service.save('sid-1', 'en', '203.0.113.7')).resolves.toEqual({
      locale: 'en',
      saved: true,
    });
    expect(idp.calls).toEqual([
      { token: 'at-1', locale: 'en', userIp: '203.0.113.7' },
    ]);
    expect(sessions.setSessionLocale).toHaveBeenCalledWith(
      'sid-1',
      'en',
      expect.any(Number),
    );
    expect(sessionAuth.refreshNow).toHaveBeenCalledTimes(1);
  });

  it('mốc locale_updated_at của phiên lấy TRƯỚC khi gọi PMH ID (thay đổi mới hơn ở PMH ID không bị coi là cũ hơn)', async () => {
    const start = 1_800_000_000_000;
    const now = jest.spyOn(Date, 'now').mockReturnValue(start + 900);
    try {
      const api: IdpLocaleApi = {
        putLocale: (_t, locale) => {
          // PUT + 401→refresh→thử lại mất vài giây
          now.mockReturnValue(start + 7_400);
          return Promise.resolve({ ok: true, locale });
        },
      };
      const { service, sessions } = makeService(api);
      await expect(service.save('sid-1', 'en')).resolves.toMatchObject({
        saved: true,
      });
      expect(sessions.setSessionLocale).toHaveBeenCalledWith(
        'sid-1',
        'en',
        Math.floor(start / 1000),
      );
    } finally {
      now.mockRestore();
    }
  });

  it('401 → refresh rồi thử lại bằng token mới → saved:true (refresh lần nữa sau khi lưu)', async () => {
    const idp = fakeIdp([
      { ok: false, reason: 'unauthorized' },
      { ok: true, locale: 'en' },
    ]);
    const { service, sessionAuth } = makeService(idp.api);
    const r = await service.save('sid-1', 'en');
    expect(r.saved).toBe(true);
    expect(idp.calls.map((c) => c.token)).toEqual(['at-1', 'at-2']);
    expect(sessionAuth.refreshNow).toHaveBeenCalledTimes(2);
  });

  it('401 hai lần → saved:false unauthorized, chỉ thử lại MỘT lần, không refresh sau', async () => {
    const idp = fakeIdp([
      { ok: false, reason: 'unauthorized' },
      { ok: false, reason: 'unauthorized' },
    ]);
    const { service, sessionAuth } = makeService(idp.api);
    await expect(service.save('sid-1', 'en')).resolves.toEqual({
      locale: 'en',
      saved: false,
      reason: 'unauthorized',
    });
    expect(idp.calls).toHaveLength(2);
    expect(sessionAuth.refreshNow).toHaveBeenCalledTimes(1);
  });

  it('401 mà refresh bị từ chối (phiên hủy) → saved:false unauthorized', async () => {
    const idp = fakeIdp([{ ok: false, reason: 'unauthorized' }]);
    const { service } = makeService(idp.api, { refreshed: null });
    const r = await service.save('sid-1', 'en');
    expect(r).toEqual({ locale: 'en', saved: false, reason: 'unauthorized' });
    expect(idp.calls).toHaveLength(1);
  });

  it.each<[IdpLocaleResult, string]>([
    [{ ok: false, reason: 'forbidden' }, 'forbidden'],
    [{ ok: false, reason: 'invalid_locale' }, 'invalid_locale'],
    [{ ok: false, reason: 'unavailable' }, 'unavailable'],
  ])(
    '%o → saved:false %s, không refresh, không ghi claims',
    async (res, reason) => {
      const idp = fakeIdp([res]);
      const { service, sessions, sessionAuth } = makeService(idp.api);
      await expect(service.save('sid-1', 'en')).resolves.toEqual({
        locale: 'en',
        saved: false,
        reason,
      });
      expect(sessions.setSessionLocale).not.toHaveBeenCalled();
      expect(sessionAuth.refreshNow).not.toHaveBeenCalled();
    },
  );

  it('429 → saved:false rate_limited + retryAfterSec', async () => {
    const idp = fakeIdp([
      { ok: false, reason: 'rate_limited', retryAfterSec: 42 },
    ]);
    const { service } = makeService(idp.api);
    await expect(service.save('sid-1', 'en')).resolves.toEqual({
      locale: 'en',
      saved: false,
      reason: 'rate_limited',
      retryAfterSec: 42,
    });
  });

  it('200 nhưng PMH ID báo giá trị khác → mismatch', async () => {
    const idp = fakeIdp([{ ok: true, locale: 'vi' }]);
    const { service } = makeService(idp.api);
    expect((await service.save('sid-1', 'en')).reason).toBe('mismatch');
  });

  it('IdP client ném / refresh ném 503 → saved:false unavailable, không ném', async () => {
    const throwing: IdpLocaleApi = {
      putLocale: () => Promise.reject(new Error('boom')),
    };
    const { service } = makeService(throwing);
    await expect(service.save('sid-1', 'en')).resolves.toEqual({
      locale: 'en',
      saved: false,
      reason: 'unavailable',
    });
    const idp = fakeIdp([{ ok: false, reason: 'unauthorized' }]);
    const s2 = makeService(idp.api, {
      refreshImpl: jest
        .fn()
        .mockRejectedValue(new ServiceUnavailableException()),
    });
    expect((await s2.service.save('sid-1', 'en')).reason).toBe('unavailable');
  });

  it('lưu xong mà refresh sau đó lỗi → vẫn saved:true (claims phiên đã mang locale mới)', async () => {
    const idp = fakeIdp([{ ok: true, locale: 'en' }]);
    const { service, sessions } = makeService(idp.api, {
      refreshImpl: jest
        .fn()
        .mockRejectedValue(new ServiceUnavailableException()),
    });
    expect((await service.save('sid-1', 'en')).saved).toBe(true);
    expect(sessions.setSessionLocale).toHaveBeenCalled();
  });

  it('phiên chưa có access token (lưu trước bản này) → refresh trước rồi gọi', async () => {
    const idp = fakeIdp([{ ok: true, locale: 'en' }]);
    const { service } = makeService(idp.api, {
      current: session({ accessToken: null }),
    });
    expect((await service.save('sid-1', 'en')).saved).toBe(true);
    expect(idp.calls[0].token).toBe('at-2');
  });

  it('phiên không còn → no_token, không gọi IdP', async () => {
    const idp = fakeIdp([]);
    const { service } = makeService(idp.api, { current: null });
    expect((await service.save('sid-1', 'en')).reason).toBe('no_token');
    expect(idp.calls).toHaveLength(0);
  });

  it('lần bấm cũ tới sau lần bấm mới hơn (cùng trang) → stale, không gọi IdP', async () => {
    const idp = fakeIdp([]);
    const { service } = makeService(idp.api);
    await service.save('sid-1', 'en', undefined, { page: 'p1', seq: 2 });
    const r = await service.save('sid-1', 'vi', undefined, {
      page: 'p1',
      seq: 1,
    });
    expect(r).toEqual({ locale: 'vi', saved: false, reason: 'stale' });
    expect(idp.calls.map((c) => c.locale)).toEqual(['en']);
  });

  it('trang khác không so seq; tuần tự theo phiên, lượt chờ bị thay bởi lượt mới hơn → superseded; lần cuối thắng, refresh MỘT lần', async () => {
    let release!: (r: IdpLocaleResult) => void;
    const first = new Promise<IdpLocaleResult>((r) => (release = r));
    const idp = fakeIdp([first]);
    const { service, sessionAuth } = makeService(idp.api);
    const a = service.save('sid-1', 'en', undefined, { page: 'p1', seq: 5 });
    await new Promise((r) => setImmediate(r)); // a đang gọi IdP
    const b = service.save('sid-1', 'vi', undefined, { page: 'p2', seq: 1 });
    const c = service.save('sid-1', 'en', undefined, { page: 'p2', seq: 2 });
    await new Promise((r) => setImmediate(r));
    expect(idp.calls).toHaveLength(1); // b, c chờ a xong
    release({ ok: true, locale: 'en' });
    const [ra, rb, rc] = await Promise.all([a, b, c]);
    expect(ra.saved).toBe(true);
    expect(rb.reason).toBe('superseded');
    expect(rc).toEqual({ locale: 'en', saved: true });
    expect(idp.calls.map((x) => x.locale)).toEqual(['en', 'en']);
    // a không phải lượt cuối → không refresh; c (cuối) refresh một lần
    expect(sessionAuth.refreshNow).toHaveBeenCalledTimes(1);
  });
});
