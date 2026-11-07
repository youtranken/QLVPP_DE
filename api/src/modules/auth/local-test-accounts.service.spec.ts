import { hashPassword } from './local-sa.service';
import { LocalTestAccountsService } from './local-test-accounts.service';

const PASS_HC = 'hc-pass-unit';
const PASS_A = 'a-pass-unit';

function makeService(enabled = true): LocalTestAccountsService {
  process.env.NODE_ENV = 'test';
  process.env.AUTH_DEV_MODE = enabled ? 'true' : 'false';
  process.env.LOCAL_TEST_ACCOUNTS = JSON.stringify([
    {
      username: 'hc.test',
      password_hash: hashPassword(PASS_HC),
      role: 'admin',
      sub: 'local-test-hc',
      name: 'HC Test',
    },
    {
      username: 'nv.a',
      password_hash: hashPassword(PASS_A),
      role: 'member',
      sub: 'local-test-a',
      name: 'Nhân viên A (test)',
    },
  ]);
  return new LocalTestAccountsService();
}

describe('LocalTestAccountsService', () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
  });

  it('tắt → enabled=false, đăng nhập đúng mật khẩu vẫn bad, findBySub null', () => {
    const svc = makeService(false);
    expect(svc.enabled).toBe(false);
    expect(svc.attemptLogin('hc.test', PASS_HC, '1.1.1.1')).toEqual({
      result: 'bad',
    });
    expect(svc.findBySub('local-test-hc')).toBeNull();
  });

  it('bật → đúng mật khẩu trả tài khoản kèm vai; mỗi tài khoản đúng vai của nó', () => {
    const svc = makeService();
    expect(svc.enabled).toBe(true);
    const hc = svc.attemptLogin('hc.test', PASS_HC, '1.1.1.1');
    expect(hc.result).toBe('ok');
    expect(hc.account).toMatchObject({ sub: 'local-test-hc', role: 'admin' });
    const a = svc.attemptLogin('nv.a', PASS_A, '1.1.1.1');
    expect(a.account).toMatchObject({ sub: 'local-test-a', role: 'member' });
  });

  it('mật khẩu của tài khoản khác hoặc username lạ → bad', () => {
    const svc = makeService();
    expect(svc.attemptLogin('nv.a', PASS_HC, '1.1.1.1').result).toBe('bad');
    expect(svc.attemptLogin('khong-co', PASS_A, '1.1.1.1').result).toBe('bad');
  });

  it('sai 4 lần → bad; lần thứ 5 → locked; sau đó locked kể cả đúng; IP khác vẫn vào được', () => {
    const svc = makeService();
    for (let i = 0; i < 4; i += 1) {
      expect(svc.attemptLogin('nv.a', 'sai', '2.2.2.2').result).toBe('bad');
    }
    expect(svc.attemptLogin('nv.a', 'sai', '2.2.2.2').result).toBe('locked');
    expect(svc.attemptLogin('nv.a', PASS_A, '2.2.2.2').result).toBe('locked');
    expect(svc.attemptLogin('nv.a', PASS_A, '3.3.3.3').result).toBe('ok');
  });

  it('findBySub chỉ trả tài khoản đã cấu hình', () => {
    const svc = makeService();
    expect(svc.findBySub('local-test-a')?.role).toBe('member');
    expect(svc.findBySub('local-test-zz')).toBeNull();
  });
});
