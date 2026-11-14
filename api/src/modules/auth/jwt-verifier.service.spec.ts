import * as jose from 'jose';
import { JwtVerifierService } from './jwt-verifier.service';
import { TokenContractError } from './token-contract.error';

const ISSUER = 'https://id.test/oidc';
const CLIENT_ID = 'vpp-test';

describe('JwtVerifierService — verify offline RS256', () => {
  let verifier: JwtVerifierService;
  let privateKey: jose.CryptoKey;

  async function sign(
    overrides: Record<string, unknown> = {},
    opts: { iss?: string; aud?: string; expOffsetSec?: number } = {},
  ): Promise<string> {
    return new jose.SignJWT({
      email: 'an.nguyen@pmh.com.vn',
      full_name: 'Nguyễn Văn An',
      employee_code: 'NV001',
      ver: 3,
      ...overrides,
    })
      .setProtectedHeader({ alg: 'RS256' })
      .setSubject('usr_test_01')
      .setIssuer(opts.iss ?? ISSUER)
      .setAudience(opts.aud ?? CLIENT_ID)
      .setIssuedAt()
      .setExpirationTime(
        Math.floor(Date.now() / 1000) + (opts.expOffsetSec ?? 300),
      )
      .sign(privateKey);
  }

  beforeAll(async () => {
    process.env.PMH_ISSUER_URL = ISSUER;
    process.env.PMH_CLIENT_ID = CLIENT_ID;
    const pair = await jose.generateKeyPair('RS256');
    privateKey = pair.privateKey;
    const publicJwk = await jose.exportJWK(pair.publicKey);
    verifier = new JwtVerifierService();
    verifier.setKeySource(jose.createLocalJWKSet({ keys: [publicJwk] }));
  });

  afterAll(() => {
    delete process.env.PMH_ISSUER_URL;
    delete process.env.PMH_CLIENT_ID;
  });

  it('token hợp lệ → claims + expiresAt từ exp', async () => {
    const token = await sign();
    const result = await verifier.verify(token);
    expect(result.claims).toEqual({
      sub: 'usr_test_01',
      email: 'an.nguyen@pmh.com.vn',
      full_name: 'Nguyễn Văn An',
      employee_code: 'NV001',
      app_role: 'member',
      ver: 3,
    });
    expect(result.expiresAt).toBeInstanceOf(Date);
    expect(result.expiresAt!.getTime()).toBeGreaterThan(Date.now());
  });

  it('token v3 → claims có department, team, app_role, ver; không có groups', async () => {
    const token = await sign({
      department: 'Phòng D&E',
      team: 'Nhóm 2',
      app_role: 'admin',
      ver: 3,
      groups: ['x'],
    });
    const { claims } = await verifier.verify(token);
    expect(claims).toEqual({
      sub: 'usr_test_01',
      email: 'an.nguyen@pmh.com.vn',
      employee_code: 'NV001',
      full_name: 'Nguyễn Văn An',
      department: 'Phòng D&E',
      team: 'Nhóm 2',
      app_role: 'admin',
      ver: 3,
    });
    expect(claims).not.toHaveProperty('groups');
  });

  it('locale + locale_updated_at (docs 7a): en-US → en, lạ → vi, thiếu → bỏ trống', async () => {
    const a = await verifier.verify(
      await sign({ locale: 'en-US', locale_updated_at: 1_762_000_000 }),
    );
    expect(a.claims.locale).toBe('en');
    expect(a.claims.locale_updated_at).toBe(1_762_000_000);
    const b = await verifier.verify(
      await sign({ locale: 'fr', locale_updated_at: null }),
    );
    expect(b.claims.locale).toBe('vi');
    expect(b.claims.locale_updated_at).toBeUndefined();
    const c = await verifier.verify(await sign());
    expect(c.claims.locale).toBeUndefined();
    expect(c.claims.locale_updated_at).toBeUndefined();
  });

  it('department "" (Chưa xếp nhóm) → undefined; team null → undefined', async () => {
    const { claims } = await verifier.verify(
      await sign({ department: '', team: null }),
    );
    expect(claims.department).toBeUndefined();
    expect(claims.team).toBeUndefined();
    const dept = async (v: unknown) =>
      (await verifier.verify(await sign({ department: v }))).claims.department;
    expect(await dept('  Phòng D&E ')).toBe('Phòng D&E');
    expect(await dept('A\u0000B')).toBe('AB');
  });

  it.each([
    ['admin', 'admin'],
    ['member', 'member'],
    ['ADMIN', 'member'],
    [undefined, 'member'],
    [123, 'member'],
  ])('app_role chỉ "admin" mới là admin: %p → %s', async (v, expected) => {
    const { claims } = await verifier.verify(await sign({ app_role: v }));
    expect(claims.app_role).toBe(expected);
  });

  it('ver 3 được', async () => {
    await expect(
      verifier.verify(await sign({ ver: 3 })),
    ).resolves.toBeDefined();
  });

  it.each([[2], [4], ['3'], [undefined]])(
    'ver %p → TokenContractError mang ver gốc',
    async (ver) => {
      const err: unknown = await verifier
        .verify(await sign({ ver }))
        .catch((e: unknown) => e);
      expect(err).toBeInstanceOf(TokenContractError);
      expect((err as TokenContractError).ver).toBe(ver);
    },
  );

  it('ver sai nhưng chữ ký sai → lỗi chữ ký, không phải TokenContractError', async () => {
    const other = await jose.generateKeyPair('RS256');
    const forged = await new jose.SignJWT({ ver: 2 })
      .setProtectedHeader({ alg: 'RS256' })
      .setSubject('usr_test_01')
      .setIssuer(ISSUER)
      .setAudience(CLIENT_ID)
      .setExpirationTime('5m')
      .sign(other.privateKey);
    const err: unknown = await verifier.verify(forged).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(Error);
    expect(err).not.toBeInstanceOf(TokenContractError);
  });

  it('issuedAt = iat * 1000; thiếu iat → null', async () => {
    const iat = Math.floor(Date.now() / 1000) - 10;
    const withIat = await new jose.SignJWT({ ver: 3 })
      .setProtectedHeader({ alg: 'RS256' })
      .setSubject('usr_test_01')
      .setIssuer(ISSUER)
      .setAudience(CLIENT_ID)
      .setIssuedAt(iat)
      .setExpirationTime('5m')
      .sign(privateKey);
    expect((await verifier.verify(withIat)).issuedAt).toEqual(
      new Date(iat * 1000),
    );
    const noIat = await new jose.SignJWT({ ver: 3 })
      .setProtectedHeader({ alg: 'RS256' })
      .setSubject('usr_test_01')
      .setIssuer(ISSUER)
      .setAudience(CLIENT_ID)
      .setExpirationTime('5m')
      .sign(privateKey);
    expect((await verifier.verify(noIat)).issuedAt).toBeNull();
  });

  it('claim team "  Team Test " → claims.team "Team Test"; thiếu, rỗng hoặc không phải chuỗi → undefined; quá 120 ký tự → cắt còn 120', async () => {
    const team = async (v: unknown) =>
      (await verifier.verify(await sign({ team: v }))).claims.team;
    expect(await team('  Team Test ')).toBe('Team Test');
    expect(await team('   ')).toBeUndefined();
    expect(await team(7)).toBeUndefined();
    expect((await verifier.verify(await sign())).claims.team).toBeUndefined();
    expect(await team('x'.repeat(121))).toBe('x'.repeat(120));
    expect(await team('x'.repeat(120))).toBe('x'.repeat(120));
    expect(await team('A\u0000B\u001fC\u007f')).toBe('ABC');
    expect(await team('\u0000\u0007')).toBeUndefined();
  });

  it('sai audience → fail', async () => {
    const token = await sign({}, { aud: 'app-khac' });
    await expect(verifier.verify(token)).rejects.toThrow();
  });

  it('sai issuer → fail', async () => {
    const token = await sign({}, { iss: 'https://id-gia-mao.test/oidc' });
    await expect(verifier.verify(token)).rejects.toThrow();
  });

  it('hết hạn quá clockTolerance (−120s) → fail', async () => {
    const token = await sign({}, { expOffsetSec: -120 });
    await expect(verifier.verify(token)).rejects.toThrow();
  });

  it('hết hạn trong clockTolerance ±60s (−30s) → vẫn pass (chống 401 chập chờn)', async () => {
    const token = await sign({}, { expOffsetSec: -30 });
    await expect(verifier.verify(token)).resolves.toBeDefined();
  });

  describe('mép clockTolerance 60 s (đồng hồ đứng yên ở giây tròn)', () => {
    beforeEach(() => {
      jest.useFakeTimers({
        now: new Date('2026-11-01T00:00:00.000Z'),
        doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'],
      });
    });
    afterEach(() => jest.useRealTimers());

    // jose coi exp <= now − tolerance là hết hạn → đúng 60 s đã fail
    it('exp lệch 59 s → pass; lệch đúng 60 s → fail; 61 s → fail', async () => {
      await expect(
        verifier.verify(await sign({}, { expOffsetSec: -59 })),
      ).resolves.toBeDefined();
      await expect(
        verifier.verify(await sign({}, { expOffsetSec: -60 })),
      ).rejects.toThrow();
      await expect(
        verifier.verify(await sign({}, { expOffsetSec: -61 })),
      ).rejects.toThrow();
    });
  });

  it('token thiếu claim exp → fail (không được refresh-mỗi-request)', async () => {
    const token = await new jose.SignJWT({})
      .setProtectedHeader({ alg: 'RS256' })
      .setSubject('usr_test_01')
      .setIssuer(ISSUER)
      .setAudience(CLIENT_ID)
      .sign(privateKey); // không setExpirationTime
    await expect(verifier.verify(token)).rejects.toThrow(/exp/);
  });

  it('token thiếu claim sub → fail (không cho identity undefined)', async () => {
    const token = await new jose.SignJWT({})
      .setProtectedHeader({ alg: 'RS256' })
      .setIssuer(ISSUER)
      .setAudience(CLIENT_ID)
      .setExpirationTime('5m')
      .sign(privateKey); // không setSubject
    await expect(verifier.verify(token)).rejects.toThrow(/sub/);
  });

  it('token ký bằng khóa khác → fail', async () => {
    const otherPair = await jose.generateKeyPair('RS256');
    const forged = await new jose.SignJWT({})
      .setProtectedHeader({ alg: 'RS256' })
      .setSubject('usr_test_01')
      .setIssuer(ISSUER)
      .setAudience(CLIENT_ID)
      .setExpirationTime('5m')
      .sign(otherPair.privateKey);
    await expect(verifier.verify(forged)).rejects.toThrow();
  });
});
