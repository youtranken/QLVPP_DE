import { InternalServerErrorException } from '@nestjs/common';
import { DirectorySyncService } from './directory-sync.service';
import type { DirectoryUser } from './directory.client';

interface ExistingRow {
  sub: string;
  email: string | null;
  employeeCode: string | null;
  fullName: string | null;
  department?: string | null;
  team?: string | null;
  status: string;
  role?: string;
}

const START = new Date('2026-11-08T03:00:00Z');

function makeService(opts: {
  users?: DirectoryUser[];
  existingRows?: ExistingRow[];
  fetchError?: Error;
  txError?: Error;
}) {
  const inserted: unknown[] = [];
  const updatedSubs: Record<string, unknown>[] = [];
  const tx = {
    select: jest.fn().mockReturnValue({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          orderBy: jest.fn().mockReturnValue({
            for: jest.fn().mockResolvedValue(
              (opts.existingRows ?? []).map((r) => ({
                department: null,
                team: null,
                role: 'member',
                ...r,
              })),
            ),
          }),
        }),
      }),
    }),
    insert: jest.fn().mockImplementation(() => ({
      values: jest.fn().mockImplementation((rows: unknown[]) => {
        inserted.push(...rows);
        return { onConflictDoUpdate: jest.fn().mockResolvedValue(undefined) };
      }),
    })),
    update: jest.fn().mockImplementation(() => ({
      set: jest.fn().mockImplementation((set: Record<string, unknown>) => ({
        where: jest.fn().mockImplementation(() => {
          updatedSubs.push(set);
          return Promise.resolve(undefined);
        }),
      })),
    })),
  };
  const db = {
    execute: jest.fn().mockResolvedValue({ rows: [{ now: START }] }),
    transaction: jest
      .fn()
      .mockImplementation(async (fn: (t: unknown) => Promise<void>) => {
        if (opts.txError) throw opts.txError;
        return fn(tx);
      }),
  };
  const directory = {
    fetchUsers: opts.fetchError
      ? jest.fn().mockRejectedValue(opts.fetchError)
      : jest.fn().mockResolvedValue(opts.users ?? []),
    fetchUser: jest.fn().mockResolvedValue(null),
    requestCount: jest.fn().mockReturnValue(1),
    resetCount: jest.fn(),
  };
  const audit = { append: jest.fn().mockResolvedValue(undefined) };
  const access = { restoreActive: jest.fn().mockResolvedValue(true) };
  const reconcile = {
    run: jest
      .fn()
      .mockResolvedValue({ no_access: 0, unconfirmed: 0, reconcile: 'ok' }),
  };
  const service = new DirectorySyncService(
    db as never,
    directory,
    audit as never,
    access as never,
    reconcile as never,
  );
  return {
    service,
    access,
    reconcile,
    db,
    directory,
    audit,
    inserted,
    updatedSubs,
  };
}

const user = (
  id: string,
  status: DirectoryUser['status'] = 'active',
  extra: Partial<DirectoryUser> = {},
): DirectoryUser => ({
  id,
  employee_code: `NV-${id}`,
  email: `${id}@pmh.com.vn`,
  full_name: `User ${id}`,
  status,
  ...extra,
});

const existingOf = (u: DirectoryUser): ExistingRow => ({
  sub: u.id,
  email: u.email ?? null,
  employeeCode: u.employee_code ?? null,
  fullName: u.full_name ?? null,
  status: u.status,
});

describe('DirectorySyncService', () => {
  it('user mới INSERT (batch), user đổi UPDATE, user y nguyên → unchanged ', async () => {
    const a = user('a'); // đã có, không đổi
    const b = user('b'); // đã có, đổi tên
    const { service, inserted, updatedSubs, audit } = makeService({
      users: [a, { ...b, full_name: 'Tên mới' }, user('c')],
      existingRows: [existingOf(a), existingOf(b)],
    });
    const result = await service.sync('sa-1');
    expect(result).toMatchObject({
      total: 3,
      created: 1,
      updated: 1,
      unchanged: 1,
      skipped: 0,
    });
    expect(inserted).toHaveLength(1);
    expect(updatedSubs).toHaveLength(1);
    expect(audit.append).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'users.directory_sync' }),
    );
  });

  it('record thiếu id → skipped, KHÔNG phá cả đợt; id trùng → khử trùng lặp', async () => {
    const { service, inserted } = makeService({
      users: [
        user('a'),
        { id: null as unknown as string, status: 'active' },
        user('a', 'active', { full_name: 'Bản ghi sau thắng' }),
      ],
    });
    const result = await service.sync('sa-1');
    expect(result.skipped).toBe(1);
    expect(result.created).toBe(1); // 'a' chỉ một lần
    expect(inserted).toHaveLength(1);
    expect((inserted[0] as { fullName: string }).fullName).toBe(
      'Bản ghi sau thắng',
    );
  });

  it('field undefined trong nguồn → GIỮ giá trị cũ (chống wipe dữ liệu)', async () => {
    const a = user('a');
    const { service, updatedSubs } = makeService({
      // email undefined (API bỏ sót field), status đổi → phải update nhưng giữ email
      users: [
        {
          id: 'a',
          status: 'locked',
          employee_code: 'NV-a',
          full_name: 'User a',
        },
      ],
      existingRows: [existingOf(a)],
    });
    const result = await service.sync('sa-1');
    expect(result.updated).toBe(1);
    const set = updatedSubs[0];
    expect(set).not.toHaveProperty('email'); // không ghi đè, giữ email cũ
    expect(set.status).toBe('locked');
  });

  it('fetch lỗi → KHÔNG mở transaction, KHÔNG audit', async () => {
    const { service, db, audit } = makeService({
      fetchError: new Error('directory down'),
    });
    await expect(service.sync('sa-1')).rejects.toThrow('directory down');
    expect(db.transaction).not.toHaveBeenCalled();
    expect(audit.append).not.toHaveBeenCalled();
  });

  it('lỗi DB trong transaction → 500 DIRECTORY_SYNC_FAILED message tiếng Việt, không audit', async () => {
    const { service, audit } = makeService({
      users: [user('a')],
      txError: new Error('deadlock'),
    });
    await expect(service.sync('sa-1')).rejects.toThrow(
      InternalServerErrorException,
    );
    expect(audit.append).not.toHaveBeenCalled();
  });

  it('user chuyển deleted được phát hiện + ghi vào audit detail', async () => {
    const a = user('a');
    const { service, audit } = makeService({
      users: [{ ...a, status: 'deleted' }],
      existingRows: [existingOf(a)],
    });
    await service.sync('sa-1');
    expect(audit.append).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: expect.objectContaining({ deleted_detected: ['a'] }),
      }),
    );
  });

  it('danh bạ rỗng → 0/0/0, không gọi /groups, kết quả không có groups', async () => {
    const { service, directory } = makeService({ users: [] });
    const result = await service.sync('sa-1');
    expect(result).toMatchObject({ total: 0, created: 0, updated: 0 });
    expect(result).not.toHaveProperty('groups');
    expect(Object.keys(directory)).not.toContain('fetchGroups');
  });
});

describe('DirectorySyncService v3', () => {
  it('ghi department/team/role: department "" → NULL, team null → NULL, app_role admin → admin', async () => {
    const { service, inserted } = makeService({
      users: [
        user('a', 'active', { department: '', team: null, app_role: 'admin' }),
        user('b', 'active', { department: 'Phòng D&E', team: 'QS' }),
      ],
    });
    await service.sync('sa-1');
    expect(inserted[0]).toMatchObject({
      department: null,
      team: null,
      role: 'admin',
      status: 'active',
      inactiveAt: null,
    });
    expect(inserted[1]).toMatchObject({
      department: 'Phòng D&E',
      team: 'QS',
      role: 'member',
    });
  });

  it.each([['ADMIN'], ['member'], [undefined]])(
    'app_role %s → member (fail-closed)',
    async (app_role) => {
      const { service, inserted } = makeService({
        users: [user('a', 'active', { app_role })],
      });
      await service.sync('sa-1');
      expect(inserted[0]).toMatchObject({ role: 'member' });
    },
  );

  it('đổi vai → audit users.role_changed source directory', async () => {
    const a = user('a');
    const { service, audit } = makeService({
      users: [{ ...a, app_role: 'admin' }],
      existingRows: [{ ...existingOf(a), role: 'member' }],
    });
    const r = await service.sync('sa-1');
    expect(r.updated).toBe(1);
    expect(audit.append).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'users.role_changed',
        objectId: 'a',
        detail: { from: 'member', to: 'admin', source: 'directory' },
      }),
    );
  });

  it('người no_access mà Directory báo active → bulk giữ no_access, restoreActive(sub, syncStartedAt)', async () => {
    const a = user('a');
    const { service, access, updatedSubs } = makeService({
      users: [{ ...a, full_name: 'Tên mới' }],
      existingRows: [{ ...existingOf(a), status: 'no_access' }],
    });
    const r = await service.sync('sa-1');
    expect(updatedSubs[0]).toMatchObject({ status: 'no_access' });
    expect(access.restoreActive).toHaveBeenCalledWith(
      'a',
      START,
      'directory',
      'sa-1',
    );
    expect(r.restored).toBe(1);
  });

  it('người no_access mà Directory báo locked → theo Directory, không gọi restoreActive', async () => {
    const a = user('a');
    const { service, access, updatedSubs } = makeService({
      users: [{ ...a, status: 'locked' }],
      existingRows: [{ ...existingOf(a), status: 'no_access' }],
    });
    await service.sync('sa-1');
    expect(updatedSubs[0]).toMatchObject({ status: 'locked' });
    expect(access.restoreActive).not.toHaveBeenCalled();
  });

  it('đối chiếu nhận danh sách đã lọc + mốc bắt đầu; kết quả gộp vào DirectorySyncResult và audit', async () => {
    const { service, reconcile, audit } = makeService({
      users: [user('a'), user('b')],
    });
    reconcile.run.mockResolvedValue({
      no_access: 2,
      unconfirmed: 1,
      reconcile: 'aborted',
      reconcile_reason: 'rate_limited',
    });
    const r = await service.sync('sa-1');
    expect(reconcile.run).toHaveBeenCalledWith(
      [
        expect.objectContaining({ id: 'a' }),
        expect.objectContaining({ id: 'b' }),
      ],
      START,
      'sa-1',
    );
    expect(r).toMatchObject({
      no_access: 2,
      unconfirmed: 1,
      restored: 0,
      reconcile: 'aborted',
      reconcile_reason: 'rate_limited',
    });
    expect(audit.append).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'users.directory_sync',
        detail: expect.objectContaining({
          no_access: 2,
          restored: 0,
          unconfirmed: 1,
          reconcile: 'aborted',
          reconcile_reason: 'rate_limited',
        }),
      }),
    );
  });

  it('có record thiếu id → không đối chiếu (reconcile skipped)', async () => {
    const { service, reconcile } = makeService({
      users: [user('a'), { id: '', status: 'active' }],
    });
    const r = await service.sync('sa-1');
    expect(reconcile.run).not.toHaveBeenCalled();
    expect(r.reconcile).toBe('skipped');
  });

  it('id local* từ nguồn bị bỏ qua (không bao giờ đụng local:sa)', async () => {
    const { service, inserted } = makeService({
      users: [user('local:sa'), user('a')],
    });
    const r = await service.sync('sa-1');
    expect(inserted.map((u) => (u as { sub: string }).sub)).toEqual(['a']);
    expect(r.skipped).toBe(1);
  });

  it('resetCount() gọi trước fetchUsers (ngân sách tính từ đầu lượt)', async () => {
    const { service, directory } = makeService({ users: [] });
    await service.sync('sa-1');
    expect(directory.resetCount.mock.invocationCallOrder[0]).toBeLessThan(
      directory.fetchUsers.mock.invocationCallOrder[0],
    );
  });
});
