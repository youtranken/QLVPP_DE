import * as jose from 'jose';
import { JwtVerifierService } from './jwt-verifier.service';

const ISSUER = 'https://id.test/oidc';
const CLIENT_ID = 'vpp-test';
const BCL_EVENT = 'http://schemas.openid.net/event/backchannel-logout';

describe('JwtVerifierService.verifyLogoutToken — OIDC Back-Channel Logout 1.0', () => {
  let verifier: JwtVerifierService;
  let rsaKey: jose.CryptoKey;
  let ecKey: jose.CryptoKey;

  type Opts = {
    typ?: string | null;
    alg?: 'RS256' | 'ES256';
    jti?: string | null;
    iat?: boolean;
    exp?: boolean;
  };

  function logoutToken(
    claims: Record<string, unknown> = {},
    opts: Opts = {},
  ): Promise<string> {
    const alg = opts.alg ?? 'RS256';
    const header: jose.JWTHeaderParameters = { alg };
    const typ = opts.typ === undefined ? 'logout+jwt' : opts.typ;
    if (typ !== null) header.typ = typ;
    let jwt = new jose.SignJWT({ events: { [BCL_EVENT]: {} }, ...claims })
      .setProtectedHeader(header)
      .setSubject('usr_test_01')
      .setIssuer(ISSUER)
      .setAudience(CLIENT_ID);
    if (opts.iat !== false) jwt = jwt.setIssuedAt();
    if (opts.exp !== false) jwt = jwt.setExpirationTime('2m');
    const jti = opts.jti === undefined ? 'jti-abc' : opts.jti;
    if (jti !== null) jwt = jwt.setJti(jti);
    return jwt.sign(alg === 'RS256' ? rsaKey : ecKey);
  }

  beforeAll(async () => {
    process.env.PMH_ISSUER_URL = ISSUER;
    process.env.PMH_CLIENT_ID = CLIENT_ID;
    const rsa = await jose.generateKeyPair('RS256');
    const ec = await jose.generateKeyPair('ES256');
    rsaKey = rsa.privateKey;
    ecKey = ec.privateKey;
    // JWKS có cả khóa EC: token ES256 hợp lệ chữ ký vẫn phải bị từ chối vì PMH ID chỉ ký RS256
    const keys = [
      { ...(await jose.exportJWK(rsa.publicKey)), kid: 'rsa' },
      { ...(await jose.exportJWK(ec.publicKey)), kid: 'ec' },
    ];
    verifier = new JwtVerifierService();
    verifier.setKeySource(jose.createLocalJWKSet({ keys }));
  });

  afterAll(() => {
    delete process.env.PMH_ISSUER_URL;
    delete process.env.PMH_CLIENT_ID;
  });

  it('hợp lệ (typ logout+jwt, RS256, events, jti, iat, exp, không nonce) → sub, jti, exp; không sid → sid undefined', async () => {
    const r = await verifier.verifyLogoutToken(await logoutToken());
    expect(r).toMatchObject({ sub: 'usr_test_01', jti: 'jti-abc' });
    expect(r.sid).toBeUndefined();
    expect(r.expiresAt).toBeInstanceOf(Date);
  });

  it('có sid → trả sid', async () => {
    const r = await verifier.verifyLogoutToken(
      await logoutToken({ sid: 'sid-1' }),
    );
    expect(r.sid).toBe('sid-1');
  });

  it('sid không phải chuỗi hoặc rỗng → từ chối', async () => {
    await expect(
      verifier.verifyLogoutToken(await logoutToken({ sid: 42 })),
    ).rejects.toThrow(/sid/);
    await expect(
      verifier.verifyLogoutToken(await logoutToken({ sid: '' })),
    ).rejects.toThrow(/sid/);
  });

  it('typ "application/logout+jwt" (dạng media type đầy đủ, hoa thường) → nhận', async () => {
    await expect(
      verifier.verifyLogoutToken(
        await logoutToken({}, { typ: 'Application/Logout+JWT' }),
      ),
    ).resolves.toMatchObject({ sub: 'usr_test_01' });
  });

  it('thiếu typ → từ chối', async () => {
    await expect(
      verifier.verifyLogoutToken(await logoutToken({}, { typ: null })),
    ).rejects.toThrow(/typ/);
  });

  it('typ "JWT" (id_token/access token dùng nhầm) → từ chối', async () => {
    await expect(
      verifier.verifyLogoutToken(await logoutToken({}, { typ: 'JWT' })),
    ).rejects.toThrow(/typ/);
  });

  it('ký ES256 bằng khóa có trong JWKS → từ chối (chỉ RS256)', async () => {
    await expect(
      verifier.verifyLogoutToken(await logoutToken({}, { alg: 'ES256' })),
    ).rejects.toThrow();
  });

  it('thiếu events → từ chối', async () => {
    await expect(
      verifier.verifyLogoutToken(await logoutToken({ events: undefined })),
    ).rejects.toThrow(/events/);
  });

  it('events có khóa backchannel-logout nhưng giá trị không phải object → từ chối', async () => {
    await expect(
      verifier.verifyLogoutToken(
        await logoutToken({ events: { [BCL_EVENT]: true } }),
      ),
    ).rejects.toThrow(/events/);
  });

  it('events là mảng → từ chối', async () => {
    await expect(
      verifier.verifyLogoutToken(await logoutToken({ events: [BCL_EVENT] })),
    ).rejects.toThrow(/events/);
  });

  it('có nonce → từ chối', async () => {
    await expect(
      verifier.verifyLogoutToken(await logoutToken({ nonce: 'n' })),
    ).rejects.toThrow(/nonce/);
  });

  it('thiếu jti → từ chối (không chống dùng lại được)', async () => {
    await expect(
      verifier.verifyLogoutToken(await logoutToken({}, { jti: null })),
    ).rejects.toThrow(/jti/);
  });

  it('jti 255 ký tự → nhận; 256 ký tự → từ chối', async () => {
    await expect(
      verifier.verifyLogoutToken(
        await logoutToken({}, { jti: 'j'.repeat(255) }),
      ),
    ).resolves.toMatchObject({ jti: 'j'.repeat(255) });
    await expect(
      verifier.verifyLogoutToken(
        await logoutToken({}, { jti: 'j'.repeat(256) }),
      ),
    ).rejects.toThrow(/jti/);
  });

  it('thiếu iat → từ chối', async () => {
    await expect(
      verifier.verifyLogoutToken(await logoutToken({}, { iat: false })),
    ).rejects.toThrow(/iat/);
  });

  it('thiếu exp → từ chối (chống dùng lại vô thời hạn)', async () => {
    await expect(
      verifier.verifyLogoutToken(await logoutToken({}, { exp: false })),
    ).rejects.toThrow(/exp/);
  });
});
