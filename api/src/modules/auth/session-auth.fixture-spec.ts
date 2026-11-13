import { SessionAuthService } from './session-auth.service';
import type { SessionRecord } from './session.service';

export function makeService(opts: {
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
          accessToken: 'at-1',
          accessTokenExp: new Date(Date.now() - 60_000), // hết hạn
          claims: { sub: 'usr_1', full_name: 'Test' },
          csrfToken: 'tok',
          idToken: 'id-token-1',
          lastSeenAt: new Date(),
          expiresAt: new Date(Date.now() + 3_600_000),
          ...opts.session,
        };
  const sessions = {
    find: jest.fn().mockResolvedValue(session),
    updateTokens: jest.fn().mockResolvedValue(opts.updateResult ?? true),
    destroy: jest.fn().mockResolvedValue(1),
    expire: jest.fn().mockResolvedValue(true),
    expireIfPastMaxAge: jest.fn().mockResolvedValue(false),
    touchLastSeen: jest.fn().mockResolvedValue(undefined),
  };
  const jwtVerifier = {
    verify:
      opts.verifyImpl ??
      jest.fn().mockResolvedValue({
        claims: {
          sub: 'usr_1',
          full_name: 'Test',
          app_role: opts.refreshedAppRole ?? 'member',
          ver: 3,
        },
        expiresAt: new Date(Date.now() + 300_000),
        issuedAt: new Date(),
      }),
  };
  const oidc = {
    refresh:
      opts.refreshImpl ??
      jest
        .fn()
        .mockResolvedValue({ accessToken: 'jwt-moi', refreshToken: 'rt-2' }),
  };
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
    users as never,
    { findBySub: () => null } as never,
  );
  return { service, sessions, oidc, users, userRow, jwtVerifier };
}
