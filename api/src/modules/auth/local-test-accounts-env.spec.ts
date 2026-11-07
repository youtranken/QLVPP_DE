import {
  assertLocalTestAccountsSafe,
  parseLocalTestAccounts,
} from './local-test-accounts-env';

const HASH = 'scrypt.00ff.11ee';
const ACCOUNTS = JSON.stringify([
  {
    username: 'hc.test',
    password_hash: HASH,
    role: 'admin',
    sub: 'local-test-hc',
    name: 'HC Test',
  },
  {
    username: 'nv.a',
    password_hash: HASH,
    role: 'member',
    sub: 'local-test-a',
    name: 'Nhân viên A (test)',
    email: 'nv.a@test.local',
    department: 'Phòng Test',
    team: 'Team Test',
  },
]);

const dev = (extra: Record<string, string | undefined> = {}) => ({
  NODE_ENV: 'development',
  AUTH_DEV_MODE: 'true',
  LOCAL_TEST_ACCOUNTS: ACCOUNTS,
  ...extra,
});

describe('parseLocalTestAccounts — chỉ bật khi đủ cả hai cờ', () => {
  it('mặc định (không biến nào) → tắt (null)', () => {
    expect(parseLocalTestAccounts({})).toBeNull();
  });

  it('có LOCAL_TEST_ACCOUNTS nhưng AUTH_DEV_MODE tắt → tắt', () => {
    expect(
      parseLocalTestAccounts(dev({ AUTH_DEV_MODE: undefined })),
    ).toBeNull();
    expect(parseLocalTestAccounts(dev({ AUTH_DEV_MODE: 'false' }))).toBeNull();
  });

  it('AUTH_DEV_MODE=true nhưng NODE_ENV=production → tắt', () => {
    expect(parseLocalTestAccounts(dev({ NODE_ENV: 'production' }))).toBeNull();
  });

  it('AUTH_DEV_MODE=true nhưng LOCAL_TEST_ACCOUNTS rỗng → tắt', () => {
    expect(parseLocalTestAccounts(dev({ LOCAL_TEST_ACCOUNTS: '' }))).toBeNull();
    expect(
      parseLocalTestAccounts(dev({ LOCAL_TEST_ACCOUNTS: '  ' })),
    ).toBeNull();
  });

  it('đủ hai cờ (development hoặc test) → danh sách tài khoản đã chuẩn hóa', () => {
    for (const nodeEnv of ['development', 'test']) {
      const accounts = parseLocalTestAccounts(dev({ NODE_ENV: nodeEnv }));
      expect(accounts).toEqual([
        {
          username: 'hc.test',
          passwordHash: HASH,
          role: 'admin',
          sub: 'local-test-hc',
          name: 'HC Test',
          email: null,
          department: null,
          team: null,
        },
        {
          username: 'nv.a',
          passwordHash: HASH,
          role: 'member',
          sub: 'local-test-a',
          name: 'Nhân viên A (test)',
          email: 'nv.a@test.local',
          department: 'Phòng Test',
          team: 'Team Test',
        },
      ]);
    }
  });
});

describe('team tùy chọn của tài khoản thử', () => {
  const withTeam = (team: string) =>
    dev({
      LOCAL_TEST_ACCOUNTS: JSON.stringify([
        {
          username: 'nv.t',
          password_hash: HASH,
          role: 'member',
          sub: 'local-test-t',
          name: 'NV T',
          team,
        },
      ]),
    });

  it('team 120 ký tự được; 121 ký tự → từ chối khởi động', () => {
    expect(
      parseLocalTestAccounts(withTeam('x'.repeat(120)))![0].team,
    ).toHaveLength(120);
    expect(() => parseLocalTestAccounts(withTeam('x'.repeat(121)))).toThrow(
      /team/,
    );
  });
});

describe('assertLocalTestAccountsSafe — fail-closed lúc khởi động', () => {
  it('NODE_ENV=production + LOCAL_TEST_ACCOUNTS → ném, kể cả khi AUTH_DEV_MODE tắt', () => {
    expect(() =>
      assertLocalTestAccountsSafe(
        dev({ NODE_ENV: 'production', AUTH_DEV_MODE: undefined }),
      ),
    ).toThrow(/LOCAL_TEST_ACCOUNTS/);
  });

  it('NODE_ENV ngoài allowlist (staging, trống) + LOCAL_TEST_ACCOUNTS → ném', () => {
    expect(() =>
      assertLocalTestAccountsSafe(dev({ NODE_ENV: 'staging' })),
    ).toThrow(/LOCAL_TEST_ACCOUNTS/);
    expect(() =>
      assertLocalTestAccountsSafe(dev({ NODE_ENV: undefined })),
    ).toThrow(/LOCAL_TEST_ACCOUNTS/);
  });

  it('production không đặt biến (hoặc rỗng) → không ném', () => {
    expect(() =>
      assertLocalTestAccountsSafe({ NODE_ENV: 'production' }),
    ).not.toThrow();
    expect(() =>
      assertLocalTestAccountsSafe({
        NODE_ENV: 'production',
        LOCAL_TEST_ACCOUNTS: '',
      }),
    ).not.toThrow();
  });

  it('dev hợp lệ → không ném', () => {
    expect(() => assertLocalTestAccountsSafe(dev())).not.toThrow();
  });

  it('dev nhưng AUTH_DEV_MODE tắt → bỏ qua biến, không kiểm cú pháp', () => {
    expect(() =>
      assertLocalTestAccountsSafe(
        dev({ AUTH_DEV_MODE: undefined, LOCAL_TEST_ACCOUNTS: 'rác' }),
      ),
    ).not.toThrow();
  });

  const bad = (accounts: unknown) =>
    dev({ LOCAL_TEST_ACCOUNTS: JSON.stringify(accounts) });
  const one = (patch: Record<string, unknown>) => [
    {
      username: 'nv.a',
      password_hash: HASH,
      role: 'member',
      sub: 'local-test-a',
      name: 'A',
      ...patch,
    },
  ];

  it.each([
    ['JSON hỏng', dev({ LOCAL_TEST_ACCOUNTS: '[{' })],
    ['không phải mảng', bad({ username: 'x' })],
    ['mảng rỗng', bad([])],
    ['thiếu username', bad(one({ username: '' }))],
    ['hash sai định dạng', bad(one({ password_hash: 'scrypt$aa$bb' }))],
    ['role lạ (sa)', bad(one({ role: 'sa' }))],
    ['sub không có tiền tố local-test-', bad(one({ sub: 'a1b2c3' }))],
    ['thiếu name', bad(one({ name: ' ' }))],
    ['trùng username', bad([...one({}), ...one({ sub: 'local-test-b' })])],
    ['trùng sub', bad([...one({}), ...one({ username: 'nv.b' })])],
  ])('đang bật mà cấu hình sai (%s) → ném', (_label, env) => {
    expect(() => assertLocalTestAccountsSafe(env)).toThrow(
      /LOCAL_TEST_ACCOUNTS/,
    );
  });

  it('thông báo lỗi không chép giá trị biến (không lộ hash)', () => {
    let message = '';
    try {
      assertLocalTestAccountsSafe(bad(one({ role: 'sa' })));
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).not.toContain(HASH);
  });
});
