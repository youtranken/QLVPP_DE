import { WebhookEventsService } from './webhook-events.service';
import type { PmhWebhookEventV3 } from './webhook-events.service';

const CLIENT = 'client_vpp';
const AT = '2026-11-08T03:00:00.000Z';
const ASKED = new Date('2026-11-08T03:00:05.000Z');
const IN_ACTIVE = { kind: 'in', user: { id: 'u1', status: 'active' } };

function setup(opts: { user?: { status: string } | null } = {}) {
  // seq lớn nhất đã áp theo (sub, loại) — mô phỏng webhook_user_order
  const seqs = new Map<string, bigint>();
  const access = {
    claimSeq: jest.fn((sub: string, cat: string, seq: bigint) => {
      const key = `${sub}:${cat}`;
      const cur = seqs.get(key) ?? -1n;
      if (cur > seq) return Promise.resolve(false);
      seqs.set(key, seq);
      return Promise.resolve(true);
    }),
    setAccessRevokedMark: jest.fn().mockResolvedValue(undefined),
    markNoAccess: jest.fn().mockResolvedValue(true),
    restoreActive: jest.fn().mockResolvedValue(true),
    lookup: jest.fn().mockResolvedValue({ kind: 'out' }),
    dbNow: jest.fn().mockResolvedValue(ASKED),
    applyDirectoryUser: jest.fn().mockResolvedValue(undefined),
    applyWebhookProfile: jest.fn().mockResolvedValue(undefined),
    applyRole: jest.fn().mockResolvedValue(true),
  };
  const users = {
    findBySub: jest
      .fn()
      .mockResolvedValue(
        opts.user === undefined ? { status: 'active' } : opts.user,
      ),
    setStatus: jest.fn().mockResolvedValue(undefined),
  };
  const sessions = { destroyAllForUser: jest.fn().mockResolvedValue(2) };
  const audit = { append: jest.fn().mockResolvedValue(undefined) };
  const service = new WebhookEventsService(
    access as never,
    users as never,
    sessions as never,
    audit as never,
  );
  return { service, access, users, sessions, audit };
}

const ev = (
  type: string,
  event_id: string,
  extra: Partial<PmhWebhookEventV3> = {},
): PmhWebhookEventV3 => ({
  type,
  user_id: 'u1',
  event_id,
  detail: { client_id: CLIENT },
  at: AT,
  ...extra,
});

describe('WebhookEventsService', () => {
  beforeAll(() => {
    process.env.PMH_CLIENT_ID = CLIENT;
  });
  afterAll(() => {
    delete process.env.PMH_CLIENT_ID;
  });

  it('access_revoked → dấu thu hồi, no_access, hủy phiên, audit auth.session_revoked', async () => {
    const { service, access, sessions, audit } = setup();
    await service.apply(ev('user.access_revoked', '10'));
    expect(access.claimSeq).toHaveBeenCalledWith('u1', 'access', 10n);
    expect(access.setAccessRevokedMark).toHaveBeenCalledWith('u1', true);
    expect(access.markNoAccess).toHaveBeenCalledWith(
      'u1',
      'webhook',
      'system(webhook)',
    );
    expect(sessions.destroyAllForUser).toHaveBeenCalledWith('u1');
    expect(audit.append).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'auth.session_revoked',
        objectId: 'u1',
        detail: { event: 'user.access_revoked', sessions_killed: 2 },
      }),
    );
  });

  it.each([
    ['user.access_revoked'],
    ['user.access_granted'],
    ['user.role_changed'],
  ])(
    '%s của client khác (detail.client_id ≠ PMH_CLIENT_ID) → không đổi gì',
    async (type) => {
      const { service, access, sessions } = setup();
      await service.apply(
        ev(type, '10', {
          detail: { client_id: 'client_qlts' },
          app_role: 'admin',
        }),
      );
      await service.apply(ev(type, '11', { detail: undefined }));
      expect(access.claimSeq).not.toHaveBeenCalled();
      expect(access.markNoAccess).not.toHaveBeenCalled();
      expect(access.applyRole).not.toHaveBeenCalled();
      expect(sessions.destroyAllForUser).not.toHaveBeenCalled();
    },
  );

  it('access_granted cho user đã có, đang no_access, Directory xác nhận active → cập nhật hồ sơ rồi restoreActive(sub, at)', async () => {
    const { service, access } = setup({ user: { status: 'no_access' } });
    access.lookup.mockResolvedValue(IN_ACTIVE);
    const e = ev('user.access_granted', '12', {
      department: 'Phòng D&E',
      team: null,
      app_role: 'member',
    });
    await service.apply(e);
    expect(access.setAccessRevokedMark).toHaveBeenCalledWith('u1', false);
    expect(access.applyWebhookProfile).toHaveBeenCalledWith(e);
    expect(access.restoreActive).toHaveBeenCalledWith(
      'u1',
      new Date(AT),
      'webhook',
      'system(webhook)',
    );
  });

  it.each([[{ kind: 'out' }], [{ kind: 'unknown' }]])(
    'access_granted cho user no_access, Directory %j → giữ no_access, không restore',
    async (res) => {
      const { service, access, users } = setup({
        user: { status: 'no_access' },
      });
      access.lookup.mockResolvedValue(res);
      await service.apply(ev('user.access_granted', '12'));
      expect(access.restoreActive).not.toHaveBeenCalled();
      expect(users.setStatus).not.toHaveBeenCalled();
    },
  );

  it('locked → access_revoked → access_granted, Directory vẫn báo locked → về locked, không active', async () => {
    const { service, access, users } = setup({ user: { status: 'no_access' } });
    access.lookup.mockResolvedValue({
      kind: 'in',
      user: { id: 'u1', status: 'locked' },
    });
    await service.apply(ev('user.locked', '20', { detail: undefined }));
    await service.apply(ev('user.access_revoked', '21'));
    await service.apply(ev('user.access_granted', '22'));
    expect(access.restoreActive).not.toHaveBeenCalled();
    expect(users.setStatus).toHaveBeenLastCalledWith('u1', 'locked');
  });

  it.each([['user.locked'], ['user.access_revoked'], ['user.role_changed']])(
    '%s cho user_id local:sa / local-test-* → bỏ qua hoàn toàn',
    async (type) => {
      const { service, access, users, sessions } = setup();
      for (const user_id of ['local:sa', 'local-test-admin']) {
        await service.apply(ev(type, '30', { user_id, app_role: 'member' }));
      }
      expect(access.claimSeq).not.toHaveBeenCalled();
      expect(access.markNoAccess).not.toHaveBeenCalled();
      expect(access.applyRole).not.toHaveBeenCalled();
      expect(users.setStatus).not.toHaveBeenCalled();
      expect(sessions.destroyAllForUser).not.toHaveBeenCalled();
    },
  );

  it('PMH_CLIENT_ID không đặt → sự kiện theo app thiếu detail.client_id bị bỏ qua', async () => {
    delete process.env.PMH_CLIENT_ID;
    try {
      const { service, access } = setup();
      await service.apply(ev('user.access_revoked', '10', { detail: {} }));
      expect(access.claimSeq).not.toHaveBeenCalled();
    } finally {
      process.env.PMH_CLIENT_ID = CLIENT;
    }
  });

  it('access_granted cho user active → chỉ cập nhật hồ sơ, không restore', async () => {
    const { service, access } = setup({ user: { status: 'active' } });
    await service.apply(ev('user.access_granted', '12'));
    expect(access.applyWebhookProfile).toHaveBeenCalled();
    expect(access.restoreActive).not.toHaveBeenCalled();
  });

  it.each([['user.access_granted'], ['user.created']])(
    '%s cho user chưa có: lookup in → applyDirectoryUser; out/unknown → không tạo',
    async (type) => {
      const dirUser = { id: 'u1', status: 'active' };
      const a = setup({ user: null });
      a.access.lookup.mockResolvedValue({ kind: 'in', user: dirUser });
      await a.service.apply(ev(type, '5'));
      expect(a.access.applyDirectoryUser).toHaveBeenCalledWith(
        dirUser,
        'system(webhook)',
      );
      for (const res of [{ kind: 'out' }, { kind: 'unknown' }]) {
        const b = setup({ user: null });
        b.access.lookup.mockResolvedValue(res);
        await b.service.apply(ev(type, '5'));
        expect(b.access.applyDirectoryUser).not.toHaveBeenCalled();
      }
    },
  );

  it('user.created không cần detail.client_id (gửi mọi app user vào được)', async () => {
    const { service, access } = setup({ user: null });
    access.lookup.mockResolvedValue({
      kind: 'in',
      user: { id: 'u1', status: 'active' },
    });
    await service.apply(ev('user.created', '5', { detail: undefined }));
    expect(access.applyDirectoryUser).toHaveBeenCalled();
  });

  it.each([
    ['user.locked', 'locked'],
    ['user.deleted', 'deleted'],
  ])('%s → setStatus %s, hủy phiên, audit', async (type, status) => {
    const { service, access, users, sessions, audit } = setup();
    await service.apply(ev(type, '7', { detail: undefined }));
    expect(access.claimSeq).toHaveBeenCalledWith('u1', 'status', 7n);
    expect(users.setStatus).toHaveBeenCalledWith('u1', status);
    expect(sessions.destroyAllForUser).toHaveBeenCalledWith('u1');
    expect(audit.append).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'auth.session_revoked',
        detail: { event: type, sessions_killed: 2, status },
      }),
    );
  });

  it.each([['user.unlocked'], ['user.reactivated']])(
    '%s: lookup in → hồ sơ + restoreActive (mốc lúc hỏi); out → no_access; unknown → giữ nguyên',
    async (type) => {
      const dirUser = { id: 'u1', status: 'active' };
      const a = setup({ user: { status: 'locked' } });
      a.access.lookup.mockResolvedValue({ kind: 'in', user: dirUser });
      await a.service.apply(ev(type, '8'));
      expect(a.access.applyDirectoryUser).toHaveBeenCalledWith(
        dirUser,
        'system(webhook)',
      );
      expect(a.access.restoreActive).toHaveBeenCalledWith(
        'u1',
        ASKED,
        'webhook',
        'system(webhook)',
        ['no_access', 'locked', 'deleted'],
      );
      expect(a.users.setStatus).not.toHaveBeenCalled();

      const b = setup({ user: { status: 'locked' } });
      b.access.lookup.mockResolvedValue({ kind: 'out' });
      await b.service.apply(ev(type, '8'));
      expect(b.access.markNoAccess).toHaveBeenCalledWith(
        'u1',
        'webhook',
        'system(webhook)',
      );
      expect(b.users.setStatus).not.toHaveBeenCalled();

      const c = setup({ user: { status: 'locked' } });
      c.access.lookup.mockResolvedValue({ kind: 'unknown' });
      await c.service.apply(ev(type, '8'));
      expect(c.users.setStatus).not.toHaveBeenCalled();
      expect(c.access.markNoAccess).not.toHaveBeenCalled();
    },
  );

  it('unlocked khi user đã mất quyền (lookup out) → no_access, không về active', async () => {
    const { service, access, users } = setup({ user: { status: 'locked' } });
    access.lookup.mockResolvedValue({ kind: 'out' });
    await service.apply(ev('user.unlocked', '9'));
    expect(access.markNoAccess).toHaveBeenCalled();
    expect(users.setStatus).not.toHaveBeenCalledWith('u1', 'active');
  });

  it('unlocked nhưng Directory vẫn báo locked → theo Directory', async () => {
    const { service, access, users } = setup({ user: { status: 'locked' } });
    access.lookup.mockResolvedValue({
      kind: 'in',
      user: { id: 'u1', status: 'locked' },
    });
    await service.apply(ev('user.unlocked', '9'));
    expect(users.setStatus).toHaveBeenCalledWith('u1', 'locked');
  });

  it('password_changed → hủy phiên, không đổi status, không xét seq', async () => {
    const { service, access, users, sessions } = setup();
    await service.apply(ev('user.password_changed', '3'));
    expect(sessions.destroyAllForUser).toHaveBeenCalledWith('u1');
    expect(users.setStatus).not.toHaveBeenCalled();
    expect(access.claimSeq).not.toHaveBeenCalled();
  });

  it('groups_changed → applyWebhookProfile (department/team, app_role nếu có)', async () => {
    const { service, access } = setup();
    const e = ev('user.groups_changed', '4', {
      detail: undefined,
      department: '',
      team: 'QS',
      app_role: 'admin',
    });
    await service.apply(e);
    expect(access.claimSeq).toHaveBeenCalledWith('u1', 'profile', 4n);
    expect(access.applyWebhookProfile).toHaveBeenCalledWith(e);
  });

  it.each([
    ['admin', 'admin'],
    ['ADMIN', 'member'],
    ['member', 'member'],
    [undefined, 'member'],
  ])(
    'role_changed app_role %s → applyRole %s, không hủy phiên',
    async (appRole, role) => {
      const { service, access, sessions } = setup();
      await service.apply(
        ev('user.role_changed', '6', {
          app_role: appRole,
          detail: { client_id: CLIENT, change: 'added' },
        }),
      );
      expect(access.claimSeq).toHaveBeenCalledWith('u1', 'profile', 6n);
      expect(access.applyRole).toHaveBeenCalledWith('u1', role, 'webhook');
      expect(sessions.destroyAllForUser).not.toHaveBeenCalled();
    },
  );

  describe('thứ tự theo seq', () => {
    it('access 10 đã áp, access_granted seq 9 tới sau → bỏ qua; seq 11 → áp; groups_changed seq 9 (profile) → vẫn áp', async () => {
      const { service, access } = setup({ user: { status: 'no_access' } });
      access.lookup.mockResolvedValue(IN_ACTIVE);
      await service.apply(ev('user.access_revoked', '10'));
      await service.apply(ev('user.access_granted', '9'));
      expect(access.setAccessRevokedMark).not.toHaveBeenCalledWith('u1', false);
      expect(access.restoreActive).not.toHaveBeenCalled();
      await service.apply(ev('user.groups_changed', '9'));
      expect(access.applyWebhookProfile).toHaveBeenCalledTimes(1);
      await service.apply(ev('user.access_granted', '11'));
      expect(access.restoreActive).toHaveBeenCalledTimes(1);
    });

    it('status 8 đã áp, locked seq 7 tới trễ → bỏ qua', async () => {
      const { service, users } = setup({ user: { status: 'locked' } });
      await service.apply(ev('user.deleted', '8'));
      await service.apply(ev('user.locked', '7'));
      expect(users.setStatus).toHaveBeenCalledTimes(1);
      expect(users.setStatus).toHaveBeenCalledWith('u1', 'deleted');
    });
  });

  it('at thiếu/không parse được → restoreActive dùng giờ hiện tại', async () => {
    const { service, access } = setup({ user: { status: 'no_access' } });
    access.lookup.mockResolvedValue(IN_ACTIVE);
    const before = Date.now();
    await service.apply(
      ev('user.access_granted', '20', { at: 'không phải ngày' }),
    );
    const used = (access.restoreActive.mock.calls[0] as [string, Date])[1];
    expect(used.getTime()).toBeGreaterThanOrEqual(before);
  });

  it('loại khác → bỏ qua', async () => {
    const { service, access, sessions } = setup();
    await service.apply(ev('user.something_new', '1'));
    expect(access.claimSeq).not.toHaveBeenCalled();
    expect(sessions.destroyAllForUser).not.toHaveBeenCalled();
  });
});
