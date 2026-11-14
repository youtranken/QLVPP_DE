import { IDP_HTTP_TIMEOUT_SEC } from './oidc-provider';
import { OpenidClientProvider } from './openid-client.provider';

// openid-client giả — không discovery thật, không ra mạng
const discovery = jest.fn();
const refreshTokenGrant = jest.fn();
jest.mock('openid-client', () => ({
  discovery: (...args: unknown[]) => discovery(...args) as unknown,
  refreshTokenGrant: (...args: unknown[]) =>
    refreshTokenGrant(...args) as unknown,
  ClientSecretBasic: (secret: string) => ({ basic: secret }),
}));

describe('OpenidClientProvider — hạn giờ gọi PMH ID', () => {
  const saved = {
    issuer: process.env.PMH_ISSUER_URL,
    id: process.env.PMH_CLIENT_ID,
    secret: process.env.PMH_CLIENT_SECRET,
  };
  const restore = (key: string, value: string | undefined) => {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  };

  beforeEach(() => {
    process.env.PMH_ISSUER_URL = 'https://id.provider.test/oidc';
    process.env.PMH_CLIENT_ID = 'vpp-test';
    process.env.PMH_CLIENT_SECRET = 'not-a-secret';
    discovery.mockReset().mockResolvedValue({ fake: 'config' });
    refreshTokenGrant.mockReset();
  });
  afterEach(() => {
    restore('PMH_ISSUER_URL', saved.issuer);
    restore('PMH_CLIENT_ID', saved.id);
    restore('PMH_CLIENT_SECRET', saved.secret);
  });

  it('hạn giờ dùng chung là 10 s', () => {
    expect(IDP_HTTP_TIMEOUT_SEC).toBe(10);
  });

  it('discovery đặt timeout cho cấu hình ⇒ mọi lời gọi sau (refresh/token) có hạn giờ', async () => {
    refreshTokenGrant.mockResolvedValue({
      access_token: 'at-2',
      refresh_token: 'rt-2',
    });
    const provider = new OpenidClientProvider();
    await expect(provider.refresh('rt-1')).resolves.toMatchObject({
      accessToken: 'at-2',
      refreshToken: 'rt-2',
    });
    expect(discovery).toHaveBeenCalledTimes(1);
    const options = discovery.mock.calls[0][4] as { timeout?: number };
    expect(options).toMatchObject({ timeout: IDP_HTTP_TIMEOUT_SEC });
  });

  it('refresh hết giờ (TimeoutError) → ném nguyên lỗi để SessionAuth xử như lỗi mạng (503, giữ phiên)', async () => {
    refreshTokenGrant.mockRejectedValue(
      new DOMException(
        'The operation was aborted due to timeout',
        'TimeoutError',
      ),
    );
    await expect(
      new OpenidClientProvider().refresh('rt-1'),
    ).rejects.toMatchObject({ name: 'TimeoutError' });
  });

  it('discovery lỗi → 503 SSO_UNAVAILABLE, câu báo gọi "Tài khoản D&E"', async () => {
    discovery.mockRejectedValue(new TypeError('fetch failed'));
    await expect(
      new OpenidClientProvider().refresh('rt-1'),
    ).rejects.toMatchObject({
      response: {
        code: 'SSO_UNAVAILABLE',
        message:
          'Không kết nối được Tài khoản D&E — thử lại sau (đăng nhập mới tạm thời không khả dụng).',
      },
    });
  });
});
