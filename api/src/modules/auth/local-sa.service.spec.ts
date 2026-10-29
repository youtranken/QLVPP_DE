import {
  hashPassword,
  verifyPassword,
  LocalSaService,
} from './local-sa.service';

describe('scrypt hash/verify', () => {
  it('round-trip: verify đúng mật khẩu, sai mật khẩu false', () => {
    const stored = hashPassword('S3cr3t!pw');
    expect(stored).toMatch(/^scrypt\.[0-9a-f]+\.[0-9a-f]+$/);
    expect(verifyPassword('S3cr3t!pw', stored)).toBe(true);
    expect(verifyPassword('S3cr3t!px', stored)).toBe(false);
  });

  it('hash mỗi lần khác nhau (salt ngẫu nhiên) nhưng đều verify được', () => {
    const a = hashPassword('same');
    const b = hashPassword('same');
    expect(a).not.toBe(b);
    expect(verifyPassword('same', a)).toBe(true);
    expect(verifyPassword('same', b)).toBe(true);
  });

  it('định dạng lưu sai → false (không ném)', () => {
    expect(verifyPassword('x', 'not-a-hash')).toBe(false);
    expect(verifyPassword('x', 'scrypt$abc')).toBe(false);
    expect(verifyPassword('x', 'bcrypt$aa$bb')).toBe(false);
    expect(verifyPassword('x', 'scrypt$aa$')).toBe(false);
  });
});

describe('LocalSaService lockout', () => {
  const USER = 'sa';
  const PASS = 'break-glass-pw';

  function makeService(): LocalSaService {
    process.env.LOCAL_SA_USERNAME = USER;
    process.env.LOCAL_SA_PASSWORD_HASH = hashPassword(PASS);
    return new LocalSaService();
  }

  afterEach(() => {
    delete process.env.LOCAL_SA_USERNAME;
    delete process.env.LOCAL_SA_PASSWORD_HASH;
    jest.useRealTimers();
  });

  it('đúng → ok; sai → bad; lần thứ 5 → locked; sau đó locked kể cả đúng', () => {
    const svc = makeService();
    const ip = '1.1.1.1';
    expect(svc.attemptLogin(USER, PASS, ip)).toBe('ok');
    for (let i = 0; i < 4; i += 1) {
      expect(svc.attemptLogin(USER, 'bad', ip)).toBe('bad');
    }
    expect(svc.attemptLogin(USER, 'bad', ip)).toBe('locked');
    expect(svc.attemptLogin(USER, PASS, ip)).toBe('locked');
  });

  it('IP khác không bị ảnh hưởng bởi lockout của IP kia', () => {
    const svc = makeService();
    for (let i = 0; i < 5; i += 1) svc.attemptLogin(USER, 'bad', '2.2.2.2');
    expect(svc.attemptLogin(USER, PASS, '2.2.2.2')).toBe('locked');
    expect(svc.attemptLogin(USER, PASS, '3.3.3.3')).toBe('ok');
  });

  it('đăng nhập đúng RESET bộ đếm sai của IP', () => {
    const svc = makeService();
    const ip = '4.4.4.4';
    svc.attemptLogin(USER, 'bad', ip);
    svc.attemptLogin(USER, 'bad', ip);
    expect(svc.attemptLogin(USER, PASS, ip)).toBe('ok');
    // đếm lại từ đầu: 4 lần sai kế tiếp vẫn 'bad' (chưa khoá)
    for (let i = 0; i < 4; i += 1) {
      expect(svc.attemptLogin(USER, 'bad', ip)).toBe('bad');
    }
  });

  it('hết 15 phút khoá → cho thử lại (lock hết hạn)', () => {
    jest.useFakeTimers();
    const svc = makeService();
    const ip = '5.5.5.5';
    for (let i = 0; i < 5; i += 1) svc.attemptLogin(USER, 'bad', ip);
    expect(svc.attemptLogin(USER, PASS, ip)).toBe('locked');
    jest.advanceTimersByTime(15 * 60 * 1000 + 1000);
    expect(svc.attemptLogin(USER, PASS, ip)).toBe('ok');
  });
});

describe('LocalSaService — khóa theo cặp (ip, username) 5/15′ và toàn cục 50/15′', () => {
  const USER = 'sa';
  const PASS = 'break-glass-pw';
  const WINDOW_MS = 15 * 60 * 1000;

  function makeService(): LocalSaService {
    process.env.LOCAL_SA_USERNAME = USER;
    process.env.LOCAL_SA_PASSWORD_HASH = hashPassword(PASS);
    return new LocalSaService();
  }

  afterEach(() => {
    delete process.env.LOCAL_SA_USERNAME;
    delete process.env.LOCAL_SA_PASSWORD_HASH;
    jest.useRealTimers();
  });

  it('5 sai (ip A, user X) → isLocked(A,X)=true; (B,X) và (A,Y) vẫn mở', () => {
    const svc = makeService();
    for (let i = 0; i < 4; i += 1) svc.recordFailure('A', 'X');
    expect(svc.isLocked('A', 'X')).toBe(false);
    svc.recordFailure('A', 'X');
    expect(svc.isLocked('A', 'X')).toBe(true);
    expect(svc.isLocked('B', 'X')).toBe(false);
    expect(svc.isLocked('A', 'Y')).toBe(false);
  });

  it('50 sai rải 10 IP (không cặp nào đủ 5) → isLocked bất kỳ = true; 49 thì chưa', () => {
    const svc = makeService();
    for (let i = 0; i < 49; i += 1) {
      svc.recordFailure(`10.0.0.${i % 10}`, `u${Math.floor(i / 10)}`);
    }
    expect(svc.isLocked('9.9.9.9', USER)).toBe(false);
    svc.recordFailure('10.0.0.9', 'u4');
    expect(svc.isLocked('9.9.9.9', USER)).toBe(true);
    expect(svc.attemptLogin(USER, PASS, '9.9.9.9')).toBe('locked');
  });

  it('sau 15′ (fake timers) cặp và toàn cục mở lại', () => {
    jest.useFakeTimers();
    const svc = makeService();
    for (let i = 0; i < 50; i += 1) svc.recordFailure('A', `u${i}`);
    for (let i = 0; i < 5; i += 1) svc.recordFailure('B', 'X');
    expect(svc.isLocked('C', 'Z')).toBe(true);
    expect(svc.isLocked('B', 'X')).toBe(true);
    jest.advanceTimersByTime(WINDOW_MS + 1);
    expect(svc.isLocked('C', 'Z')).toBe(false);
    expect(svc.isLocked('B', 'X')).toBe(false);
  });

  it('cửa sổ trượt 15′ tính từ lần sai: 15′ − 1 ms sau lần sai thứ 5 vẫn khóa; đúng 15′ → mở, mật khẩu đúng → ok', () => {
    jest.useFakeTimers();
    const svc = makeService();
    for (let i = 0; i < 5; i += 1) svc.recordFailure('A', USER);
    jest.advanceTimersByTime(WINDOW_MS - 1);
    expect(svc.isLocked('A', USER)).toBe(true);
    expect(svc.attemptLogin(USER, PASS, 'A')).toBe('locked');
    jest.advanceTimersByTime(1);
    expect(svc.isLocked('A', USER)).toBe(false);
    expect(svc.attemptLogin(USER, PASS, 'A')).toBe('ok');
  });

  it('đăng nhập đúng KHÔNG reset bộ đếm toàn cục', () => {
    const svc = makeService();
    for (let i = 0; i < 49; i += 1) svc.recordFailure(`ip${i}`, 'u');
    expect(svc.attemptLogin(USER, PASS, '7.7.7.7')).toBe('ok');
    expect(svc.attemptLogin(USER, 'bad', '7.7.7.7')).toBe('locked');
    expect(svc.isLocked('8.8.8.8', USER)).toBe(true);
  });

  it('sai username cũng tính cho cặp (ip, username đã gửi)', () => {
    const svc = makeService();
    for (let i = 0; i < 5; i += 1) {
      svc.attemptLogin('khong-phai-sa', 'bad', '6.6.6.6');
    }
    expect(svc.isLocked('6.6.6.6', 'khong-phai-sa')).toBe(true);
    expect(svc.attemptLogin(USER, PASS, '6.6.6.6')).toBe('ok');
  });
});
