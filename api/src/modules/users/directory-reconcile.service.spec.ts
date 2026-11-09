import {
  DirectoryReconcileService,
  MASS_MIN,
  RUN_REQUEST_BUDGET,
} from './directory-reconcile.service';
import type { DirectoryUser } from './directory.client';
import type { LookupResult } from './user-access.service';

const START = new Date('2026-11-08T03:00:00Z');
const listedUser = (id: string, status: DirectoryUser['status'] = 'active') =>
  ({ id, status }) as DirectoryUser;

// pool = user SSO của VPP (active|locked, không local), listed = danh sách Directory
function setup(opts: {
  pool: string[];
  listed: DirectoryUser[];
  pagesSpent?: number;
  lookup?: (sub: string) => LookupResult;
}) {
  let count = opts.pagesSpent ?? 1;
  const directory = {
    requestCount: jest.fn(() => count),
  };
  const lookup = opts.lookup ?? (() => ({ kind: 'out' }));
  const access = {
    reconcilePool: jest.fn().mockResolvedValue(opts.pool),
    lookup: jest.fn((sub: string) => {
      count += 1;
      return Promise.resolve(lookup(sub));
    }),
    markNoAccess: jest.fn().mockResolvedValue(true),
    touchChecked: jest.fn().mockResolvedValue(undefined),
    applyDirectoryUser: jest.fn().mockResolvedValue(undefined),
    applyDirectoryStatus: jest.fn().mockResolvedValue(true),
    restoreActive: jest.fn().mockResolvedValue(false),
  };
  const audit = { append: jest.fn().mockResolvedValue(undefined) };
  const service = new DirectoryReconcileService(
    directory as never,
    access as never,
    audit as never,
  );
  return { service, access, audit, directory };
}

const ids = (prefix: string, n: number) =>
  Array.from({ length: n }, (_, i) => `${prefix}${i + 1}`);

// n user SSO, `missing` người cuối vắng danh sách; canary (người đầu) luôn có mặt
function scenario(n: number, missing: number) {
  const pool = ids('u', n);
  const listed = pool.slice(0, n - missing).map((id) => listedUser(id));
  const canary = listed[0]?.id;
  const lookup = (sub: string): LookupResult =>
    sub === canary ? { kind: 'in', user: listedUser(sub) } : { kind: 'out' };
  return { pool, listed, lookup };
}

describe('DirectoryReconcileService', () => {
  it('hằng số đúng plan', () => {
    expect(RUN_REQUEST_BUDGET).toBe(48);
    expect(MASS_MIN).toBe(5);
  });

  it('không ai vắng → ok, không hỏi Directory', async () => {
    const { service, access } = setup(scenario(3, 0));
    await expect(
      service.run(scenario(3, 0).listed, START, 'sa'),
    ).resolves.toEqual({
      no_access: 0,
      unconfirmed: 0,
      reconcile: 'ok',
    });
    expect(access.lookup).not.toHaveBeenCalled();
  });

  describe('ngưỡng hủy (candidates*2 > ssoUsers) và MASS_MIN', () => {
    it('5/10 vắng → đối chiếu, đánh dấu cả 5', async () => {
      const s = scenario(10, 5);
      const { service, access } = setup(s);
      const r = await service.run(s.listed, START, 'sa');
      expect(r).toEqual({ no_access: 5, unconfirmed: 0, reconcile: 'ok' });
      expect(access.markNoAccess).toHaveBeenCalledWith(
        'u6',
        'directory',
        'sa',
        START,
      );
    });

    it.each([
      [10, 6],
      [9, 5],
    ])(
      '%i user, %i vắng → hủy mass_missing, không hỏi ai, audit',
      async (n, m) => {
        const s = scenario(n, m);
        const { service, access, audit } = setup(s);
        const r = await service.run(s.listed, START, 'sa');
        expect(r).toEqual({
          no_access: 0,
          unconfirmed: m,
          reconcile: 'aborted',
          reconcile_reason: 'mass_missing',
        });
        expect(access.lookup).not.toHaveBeenCalled();
        expect(access.markNoAccess).not.toHaveBeenCalled();
        expect(audit.append).toHaveBeenCalledWith(
          expect.objectContaining({
            action: 'users.directory_reconcile_aborted',
            detail: { reason: 'mass_missing', candidates: m, sso_users: n },
          }),
        );
      },
    );

    it('4/6 vắng (dưới MASS_MIN) → vẫn đối chiếu', async () => {
      const s = scenario(6, 4);
      const { service } = setup(s);
      const r = await service.run(s.listed, START, 'sa');
      expect(r).toMatchObject({ no_access: 4, reconcile: 'ok' });
    });
  });

  it('listed rỗng khi có user SSO → hủy empty, không đánh dấu ai', async () => {
    const { service, access, audit } = setup({ pool: ['a', 'b'], listed: [] });
    const r = await service.run([], START, 'sa');
    expect(r).toEqual({
      no_access: 0,
      unconfirmed: 2,
      reconcile: 'aborted',
      reconcile_reason: 'empty',
    });
    expect(access.lookup).not.toHaveBeenCalled();
    expect(audit.append).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: { reason: 'empty', candidates: 2, sso_users: 2 },
      }),
    );
  });

  it('listed chỉ có user locked/deleted (không ai active) → hủy empty', async () => {
    const listed = [listedUser('a', 'locked'), listedUser('x', 'deleted')];
    const { service } = setup({ pool: ['a', 'b'], listed });
    const r = await service.run(listed, START, 'sa');
    expect(r.reconcile_reason).toBe('empty');
  });

  describe('canary', () => {
    it.each<[string, LookupResult]>([
      ['404', { kind: 'out' }],
      ['lỗi', { kind: 'unknown', code: 'DIRECTORY_UNAVAILABLE' }],
      ['id không khớp', { kind: 'in', user: listedUser('khac') }],
    ])('canary %s → hủy canary_failed, không hỏi ứng viên', async (_n, res) => {
      const s = scenario(10, 2);
      const { service, access, audit } = setup({ ...s, lookup: () => res });
      const r = await service.run(s.listed, START, 'sa');
      expect(r).toEqual({
        no_access: 0,
        unconfirmed: 2,
        reconcile: 'aborted',
        reconcile_reason: 'canary_failed',
      });
      expect(access.lookup).toHaveBeenCalledTimes(1);
      expect(access.lookup).toHaveBeenCalledWith('u1');
      expect(access.markNoAccess).not.toHaveBeenCalled();
      expect(audit.append).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'users.directory_reconcile_aborted',
        }),
      );
    });

    it('canary gặp DIRECTORY_RATE_LIMITED → hủy rate_limited', async () => {
      const s = scenario(10, 2);
      const { service } = setup({
        ...s,
        lookup: () => ({ kind: 'unknown', code: 'DIRECTORY_RATE_LIMITED' }),
      });
      const r = await service.run(s.listed, START, 'sa');
      expect(r).toMatchObject({
        reconcile: 'aborted',
        reconcile_reason: 'rate_limited',
        no_access: 0,
      });
    });

    it('canary là user active đầu tiên của listed (bỏ qua locked)', async () => {
      const pool = ['a', 'b', 'c', 'd'];
      const listed = [
        listedUser('a', 'locked'),
        listedUser('b'),
        listedUser('c'),
      ];
      const { service, access } = setup({
        pool,
        listed,
        lookup: (sub) =>
          sub === 'b' ? { kind: 'in', user: listedUser('b') } : { kind: 'out' },
      });
      await service.run(listed, START, 'sa');
      expect(access.lookup.mock.calls[0][0]).toBe('b');
    });
  });

  describe('ngân sách 48 request', () => {
    // 47 ứng viên cần ≥ 94 user SSO để không vượt ngưỡng hủy
    const s = scenario(141, 47);

    it('1 trang + canary + 46 lookup = 48 → hỏi đủ 46; ứng viên thứ 47 → unconfirmed=1', async () => {
      const { service, access } = setup({ ...s, pagesSpent: 1 });
      const r = await service.run(s.listed, START, 'sa');
      expect(access.lookup).toHaveBeenCalledTimes(1 + 46);
      expect(r).toEqual({ no_access: 46, unconfirmed: 1, reconcile: 'ok' });
      expect(access.touchChecked).toHaveBeenCalledTimes(46);
    });

    it('46 ứng viên → hỏi đủ, unconfirmed 0', async () => {
      const s46 = scenario(140, 46);
      const { service } = setup({ ...s46, pagesSpent: 1 });
      const r = await service.run(s46.listed, START, 'sa');
      expect(r).toEqual({ no_access: 46, unconfirmed: 0, reconcile: 'ok' });
    });

    it('2 trang danh bạ → chỉ còn 45 lookup', async () => {
      const { service } = setup({ ...s, pagesSpent: 2 });
      const r = await service.run(s.listed, START, 'sa');
      expect(r).toMatchObject({ no_access: 45, unconfirmed: 2 });
    });
  });

  it('lookup thứ 3 gặp DIRECTORY_RATE_LIMITED → 2 người out trước đó vẫn no_access, reason rate_limited, phần còn lại unconfirmed', async () => {
    const s = scenario(10, 5);
    let n = 0;
    const { service, access } = setup({
      ...s,
      lookup: (sub) => {
        if (sub === 'u1') return { kind: 'in', user: listedUser('u1') };
        n += 1;
        return n === 3
          ? { kind: 'unknown', code: 'DIRECTORY_RATE_LIMITED' }
          : { kind: 'out' };
      },
    });
    const r = await service.run(s.listed, START, 'sa');
    expect(r).toEqual({
      no_access: 2,
      unconfirmed: 3,
      reconcile: 'aborted',
      reconcile_reason: 'rate_limited',
    });
    expect(access.markNoAccess).toHaveBeenCalledTimes(2);
  });

  it('DIRECTORY_AUTH_FAILED giữa chừng cũng dừng vòng', async () => {
    const s = scenario(10, 3);
    const { service, access } = setup({
      ...s,
      lookup: (sub) =>
        sub === 'u1'
          ? { kind: 'in', user: listedUser('u1') }
          : { kind: 'unknown', code: 'DIRECTORY_AUTH_FAILED' },
    });
    const r = await service.run(s.listed, START, 'sa');
    expect(access.lookup).toHaveBeenCalledTimes(2);
    expect(r).toMatchObject({
      unconfirmed: 3,
      reconcile_reason: 'rate_limited',
    });
  });

  it('lỗi thường (5xx) ở một người → bỏ qua người đó, hỏi tiếp', async () => {
    const s = scenario(10, 3);
    const { service } = setup({
      ...s,
      lookup: (sub) =>
        sub === 'u1'
          ? { kind: 'in', user: listedUser('u1') }
          : sub === 'u8'
            ? { kind: 'unknown', code: 'DIRECTORY_UNAVAILABLE' }
            : { kind: 'out' },
    });
    const r = await service.run(s.listed, START, 'sa');
    expect(r).toEqual({ no_access: 2, unconfirmed: 1, reconcile: 'ok' });
  });

  it('lookup trả in (danh sách và chi tiết lệch nhau) → không đánh dấu, cập nhật hồ sơ theo dữ liệu trả về', async () => {
    const s = scenario(10, 2);
    const detail = (sub: string) =>
      ({ id: sub, status: 'active', full_name: `Tên ${sub}` }) as DirectoryUser;
    const { service, access } = setup({
      ...s,
      lookup: (sub) => ({ kind: 'in', user: detail(sub) }),
    });
    const r = await service.run(s.listed, START, 'sa');
    expect(r).toEqual({ no_access: 0, unconfirmed: 0, reconcile: 'ok' });
    expect(access.markNoAccess).not.toHaveBeenCalled();
    expect(access.touchChecked).toHaveBeenCalledTimes(2);
    // canary không bị ghi lại; chỉ 2 người vắng
    expect(access.applyDirectoryUser).toHaveBeenCalledTimes(2);
    expect(access.applyDirectoryUser).toHaveBeenCalledWith(detail('u9'), 'sa');
    expect(access.applyDirectoryUser).toHaveBeenCalledWith(
      detail('u10'),
      'sa',
    );
    expect(access.applyDirectoryStatus).not.toHaveBeenCalled();
    // active nhưng VPP đang locked → mở theo restoreActive (có mốc bắt đầu sync, có audit)
    expect(access.restoreActive).toHaveBeenCalledWith(
      'u9',
      START,
      'directory',
      'sa',
      ['locked'],
    );
  });

  it.each(['locked', 'deleted'] as const)(
    'lookup trả in với status %s → áp hồ sơ rồi đặt status đó',
    async (status) => {
      const s = scenario(10, 1);
      const { service, access } = setup({
        ...s,
        lookup: (sub) => ({
          kind: 'in',
          user: listedUser(sub, sub === 'u1' ? 'active' : status),
        }),
      });
      await service.run(s.listed, START, 'sa');
      expect(access.applyDirectoryUser).toHaveBeenCalledWith(
        listedUser('u10', status),
        'sa',
      );
      expect(access.applyDirectoryStatus).toHaveBeenCalledWith('u10', status);
      expect(access.restoreActive).not.toHaveBeenCalled();
    },
  );

  it('markNoAccess trả false (đã đổi xen giữa) → không đếm', async () => {
    const s = scenario(10, 2);
    const { service, access } = setup(s);
    access.markNoAccess.mockResolvedValue(false);
    const r = await service.run(s.listed, START, 'sa');
    expect(r.no_access).toBe(0);
  });

  it('local:sa và local-test-* không bao giờ là ứng viên', async () => {
    const s = scenario(10, 1);
    const { service, access } = setup({
      ...s,
      pool: [...s.pool, 'local:sa', 'local-test-admin'],
    });
    await service.run(s.listed, START, 'sa');
    const asked = access.lookup.mock.calls.map((c) => c[0]);
    expect(asked).not.toContain('local:sa');
    expect(asked).not.toContain('local-test-admin');
    expect(access.markNoAccess).toHaveBeenCalledTimes(1);
  });
});
