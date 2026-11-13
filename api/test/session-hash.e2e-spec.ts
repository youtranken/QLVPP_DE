import request from 'supertest';
import {
  hashSessionId,
  openToken,
  sessionRef,
} from '../src/modules/auth/session-crypto';
import { SessionService } from '../src/modules/auth/session.service';
import { SessionHarness } from './session-standard.harness';

// Chuẩn phiên chung, luật 1–4 và 8: cookie vpp_sid chỉ trình duyệt giữ; DB giữ sha256, Nhật ký giữ 12 hex
// đầu của hash; token PMH ID niêm phong v1: (AES-GCM, AAD = id_hash). Kết thúc phiên: session-end.e2e-spec.
describe('chuẩn phiên: khóa băm, token niêm phong, không lộ cookie/token', () => {
  const h = new SessionHarness();

  beforeAll(() => h.start());
  afterAll(() => h.stop());

  // Khóa = sha256(cookie); Nhật ký (DB + API) objectId = 12 hex đầu của hash
  async function expectHashedSession(
    sub: string,
    action: string,
    cookie: string,
  ): Promise<void> {
    const rows = await h.sessionRows(sub);
    expect(rows.map((r) => r.id_hash)).toContain(hashSessionId(cookie));
    const audits = await h.auditRows(sub, action, sessionRef(cookie));
    expect(audits).toHaveLength(1);
    const api = await h.auditApi(sub, action);
    const item = api.items.find((i) => i.objectId === sessionRef(cookie));
    expect(item?.objectType).toBe('session');
    expect(item?.objectId).toMatch(/^[0-9a-f]{12}$/);
    await h.expectNoSecretAnywhere();
  }

  it('đăng nhập PMH ID: token niêm phong v1: mở lại đúng với AAD của chính dòng; DB/Nhật ký/log không chứa cookie hay token', async () => {
    await h.cleanup();
    const cookie = await h.pmhLogin();
    await expectHashedSession(h.pmhSub, 'auth.login', cookie);
    const [row] = await h.sessionRows(h.pmhSub);
    const idHash = row.id_hash as string;
    for (const col of ['refresh_token', 'access_token', 'id_token']) {
      expect(row[col]).toMatch(/^v1:/);
    }
    expect(openToken(row.refresh_token as string, idHash)).toBe(
      h.loginTokens.refreshToken,
    );
    expect(openToken(row.access_token as string, idHash)).toBe(h.lastAccess);
    expect(openToken(row.id_token as string, idHash)).toBe(
      h.loginTokens.idToken,
    );
    expect(openToken(row.refresh_token as string, 'f'.repeat(64))).toBeNull();
    await h.me(cookie).expect(200);
  });

  it('chép token sang dòng phiên khác (AAD sai) → không đọc được, refresh của dòng đó thất bại', async () => {
    await h.cleanup();
    const a = await h.pmhLogin();
    const b = await h.pmhLogin();
    await h.pool.query(
      `UPDATE sessions SET refresh_token = (SELECT refresh_token FROM sessions WHERE id_hash = $1),
              access_token_exp = now() - interval '1 minute'
        WHERE id_hash = $2`,
      [hashSessionId(a), hashSessionId(b)],
    );
    const session = await h.app.get(SessionService).find(b);
    expect(session?.refreshToken).toBeNull();
    const before = h.refreshCount;
    await h.me(b).expect(401);
    expect(h.refreshCount).toBe(before);
    await h.me(a).expect(200);
  });

  it('refresh token xoay vòng: token mới cũng niêm phong; không lộ ở đâu', async () => {
    const cookie = await h.pmhLogin();
    await h.pool.query(
      `UPDATE sessions SET access_token_exp = now() - interval '1 minute' WHERE id_hash = $1`,
      [hashSessionId(cookie)],
    );
    const before = h.refreshCount;
    await h.me(cookie).expect(200);
    expect(h.refreshCount).toBe(before + 1);
    const idHash = hashSessionId(cookie);
    const row = (await h.sessionRows(h.pmhSub)).find(
      (r) => r.id_hash === idHash,
    )!;
    expect(row.refresh_token).toMatch(/^v1:/);
    expect(openToken(row.refresh_token as string, idHash)).toMatch(
      /^rt-rotated-/,
    );
    // refresh không phát id_token mới → giữ cái lúc login, vẫn niêm phong
    expect(openToken(row.id_token as string, idHash)).toBe(
      h.loginTokens.idToken,
    );
    await h.expectNoSecretAnywhere();
  });

  it('đổi tài khoản (switch-account): xóa phiên theo hash, xóa cookie', async () => {
    await h.cleanup();
    const cookie = await h.pmhLogin();
    const res = await request(h.server())
      .get('/api/auth/switch-account')
      .set('Cookie', `vpp_sid=${cookie}`)
      .expect(302);
    expect(
      ([] as string[])
        .concat(res.headers['set-cookie'] ?? [])
        .some((c) => /^vpp_sid=;/.test(c)),
    ).toBe(true);
    expect(await h.sessionRows(h.pmhSub)).toHaveLength(0);
    await h.me(cookie).expect(401);
    await h.expectNoSecretAnywhere();
  });

  it('đăng nhập SA: gửi giá trị hash trong DB làm cookie → 401 (cả tra thẳng service cũng không thấy)', async () => {
    await h.cleanup();
    const cookie = await h.saLogin();
    await expectHashedSession('local:sa', 'auth.sa_login', cookie);
    await h.me(cookie).expect(200);
    const stolen = hashSessionId(cookie);
    const rejected = await h.me(stolen).expect(401);
    expect(rejected.body).toMatchObject({ code: 'UNAUTHENTICATED' });
    expect(await h.app.get(SessionService).find(stolen)).toBeNull();
    // Phiên thật vẫn sống: cookie giả chỉ bị từ chối, không đụng phiên
    await h.me(cookie).expect(200);
  });

  it('tài khoản thử rồi đăng xuất: xóa theo hash, đúng một auth.logout cùng objectId', async () => {
    const cookie = await h.testLogin();
    await expectHashedSession(h.testSub, 'auth.test_login', cookie);
    const csrf = (
      (await h.me(cookie).expect(200)).body as { csrfToken: string }
    ).csrfToken;
    await request(h.server())
      .post('/api/auth/logout')
      .set('Cookie', `vpp_sid=${cookie}`)
      .type('form')
      .send({ csrf })
      .expect(303);
    expect(await h.sessionRows(h.testSub)).toHaveLength(0);
    const out = await h.auditRows(h.testSub, 'auth.logout');
    expect(out.map((a) => a.object_id)).toEqual([sessionRef(cookie)]);
    await h.me(cookie).expect(401);
    await h.expectNoSecretAnywhere();
  });
});
