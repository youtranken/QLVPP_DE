import {
  BadGatewayException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  DIRECTORY_PAGE_SIZE,
  DirectoryClient,
  MAX_PAGES,
  RATE_LIMIT_RETRIES,
} from './directory.client';

function jsonResponse(
  body: unknown,
  status = 200,
  headers: Record<string, string> = {},
): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (k: string) => headers[k.toLowerCase()] ?? null },
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

function textResponse(status: number): Response {
  return {
    ok: false,
    status,
    headers: { get: () => null },
    json: () => Promise.reject(new SyntaxError('html')),
  } as unknown as Response;
}

function users(from: number, count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `u${from + i}`,
    status: 'active',
  }));
}

async function errorBody(
  p: Promise<unknown>,
): Promise<{ code?: string; message?: string } | undefined> {
  try {
    await p;
  } catch (e) {
    return (e as { getResponse?: () => unknown }).getResponse?.() as
      { code?: string; message?: string } | undefined;
  }
  return undefined;
}

async function errorCode(p: Promise<unknown>): Promise<string | undefined> {
  try {
    await p;
  } catch (e) {
    const res = (e as { getResponse?: () => unknown }).getResponse?.() as
      { code?: string } | undefined;
    return res?.code;
  }
  return 'no-error';
}

describe('DirectoryClient', () => {
  const oidc = { clientCredentialsToken: jest.fn() };
  const sleep = jest.fn<Promise<void>, [number]>();
  let client: DirectoryClient;
  let fetchMock: jest.SpyInstance;

  beforeAll(() => {
    process.env.PMH_ISSUER_URL = 'https://id.test/oidc';
  });
  afterAll(() => {
    delete process.env.PMH_ISSUER_URL;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    oidc.clientCredentialsToken.mockResolvedValue('m2m-1');
    sleep.mockResolvedValue(undefined);
    client = new DirectoryClient(oidc as never, sleep);
    fetchMock = jest.spyOn(global, 'fetch');
  });

  afterEach(() => {
    fetchMock.mockRestore();
  });

  function urls(): string[] {
    return fetchMock.mock.calls.map((c) => String(c[0]));
  }

  // Trả trang theo offset trong URL, tổng `total` user
  function serveTotal(total: number) {
    fetchMock.mockImplementation((url: string) => {
      const offset = Number(new URL(url).searchParams.get('offset'));
      const n = Math.max(0, Math.min(DIRECTORY_PAGE_SIZE, total - offset));
      return Promise.resolve(jsonResponse(users(offset, n)));
    });
  }

  describe('fetchUsers — phân trang limit/offset', () => {
    it('hằng số đúng hợp đồng', () => {
      expect(DIRECTORY_PAGE_SIZE).toBe(200);
      expect(MAX_PAGES).toBe(50);
      expect(RATE_LIMIT_RETRIES).toBe(3);
    });

    it('199 user → 1 request offset=0', async () => {
      serveTotal(199);
      await expect(client.fetchUsers()).resolves.toHaveLength(199);
      expect(urls()).toEqual([
        'https://id.test/api/v1/users?include_deleted=true&limit=200&offset=0',
      ]);
      expect(client.requestCount()).toBe(1);
    });

    it('200 user → request thứ 2 offset=200 (rỗng) rồi dừng', async () => {
      serveTotal(200);
      await expect(client.fetchUsers()).resolves.toHaveLength(200);
      expect(urls()).toHaveLength(2);
      expect(urls()[1]).toContain('limit=200&offset=200');
    });

    it('400 user → 3 request', async () => {
      serveTotal(400);
      await expect(client.fetchUsers()).resolves.toHaveLength(400);
      expect(urls()).toHaveLength(3);
      expect(client.requestCount()).toBe(3);
    });

    it('đúng 50 trang, trang 50 có 199 → trả 9999 user', async () => {
      serveTotal(49 * 200 + 199);
      await expect(client.fetchUsers()).resolves.toHaveLength(9999);
      expect(urls()).toHaveLength(50);
    });

    it('đúng 10 000 user (50 trang đầy, trang 51 rỗng) → trả đủ 10 000', async () => {
      serveTotal(50 * 200);
      await expect(client.fetchUsers()).resolves.toHaveLength(10_000);
      expect(urls()).toHaveLength(51);
    });

    it('10 001 user (trang 51 còn người) → DIRECTORY_UNAVAILABLE, không trả danh sách thiếu', async () => {
      serveTotal(50 * 200 + 1);
      expect(await errorCode(client.fetchUsers())).toBe(
        'DIRECTORY_UNAVAILABLE',
      );
      expect(urls()).toHaveLength(51);
    });

    it('body {data:[…]} (không phải mảng) → DIRECTORY_UNAVAILABLE', async () => {
      fetchMock.mockResolvedValue(
        jsonResponse({ data: [{ id: 'a', status: 'active' }] }),
      );
      expect(await errorCode(client.fetchUsers())).toBe(
        'DIRECTORY_UNAVAILABLE',
      );
    });

    it('trang lặp id (API bỏ qua offset) → DIRECTORY_UNAVAILABLE', async () => {
      fetchMock.mockResolvedValue(jsonResponse(users(0, 200)));
      expect(await errorCode(client.fetchUsers())).toBe(
        'DIRECTORY_UNAVAILABLE',
      );
      expect(urls()).toHaveLength(2);
    });

    it.each([[null], ['x'], [[1]]])(
      'phần tử %j không phải object → DIRECTORY_UNAVAILABLE',
      async (bad) => {
        fetchMock.mockResolvedValue(
          jsonResponse([{ id: 'a', status: 'active' }, bad]),
        );
        expect(await errorCode(client.fetchUsers())).toBe(
          'DIRECTORY_UNAVAILABLE',
        );
      },
    );

    it('mảng rỗng ngay trang đầu → trả [] (đối chiếu tự hủy ca rỗng)', async () => {
      fetchMock.mockResolvedValue(jsonResponse([]));
      await expect(client.fetchUsers()).resolves.toEqual([]);
    });

    it('không còn gọi /api/v1/groups', async () => {
      serveTotal(400);
      await client.fetchUsers();
      fetchMock.mockResolvedValue(jsonResponse({ id: 'u1', status: 'active' }));
      await client.fetchUser('u1');
      expect(urls().every((u) => !u.includes('/groups'))).toBe(true);
    });
  });

  describe('429 — Retry-After, trần, số lần thử', () => {
    it('429 ×3 rồi 200 → thành công, sleep gọi 3 lần', async () => {
      fetchMock
        .mockResolvedValueOnce(jsonResponse({}, 429))
        .mockResolvedValueOnce(jsonResponse({}, 429))
        .mockResolvedValueOnce(jsonResponse({}, 429))
        .mockResolvedValueOnce(jsonResponse(users(0, 3)));
      await expect(client.fetchUsers()).resolves.toHaveLength(3);
      expect(sleep).toHaveBeenCalledTimes(3);
      expect(client.requestCount()).toBe(4);
    });

    it('429 ×4 → DIRECTORY_RATE_LIMITED (503)', async () => {
      fetchMock.mockResolvedValue(jsonResponse({}, 429));
      await expect(client.fetchUsers()).rejects.toThrow(
        ServiceUnavailableException,
      );
      expect(sleep).toHaveBeenCalledTimes(RATE_LIMIT_RETRIES);
      expect(fetchMock).toHaveBeenCalledTimes(RATE_LIMIT_RETRIES + 1);
      expect(await errorCode(client.fetchUsers())).toBe(
        'DIRECTORY_RATE_LIMITED',
      );
      // Câu người dùng có thể thấy gọi hệ thống là "Tài khoản D&E", không "PMH ID"
      expect((await errorBody(client.fetchUsers()))?.message).toBe(
        'Tài khoản D&E đang giới hạn tần suất đọc danh bạ — thử lại sau ít phút.',
      );
    });

    it.each([
      ['10', 10_000],
      ['11', 10_000],
      ['3', 3_000],
      [undefined, 5_000],
      ['abc', 5_000],
      ['-1', 5_000],
    ])('Retry-After %s → chờ %d ms', async (header, ms) => {
      fetchMock
        .mockResolvedValueOnce(
          jsonResponse({}, 429, header ? { 'retry-after': header } : {}),
        )
        .mockResolvedValueOnce(jsonResponse(users(0, 1)));
      await client.fetchUsers();
      expect(sleep).toHaveBeenCalledWith(ms);
    });

    it('resetCount() đưa bộ đếm về 0', async () => {
      serveTotal(1);
      await client.fetchUsers();
      expect(client.requestCount()).toBe(1);
      client.resetCount();
      expect(client.requestCount()).toBe(0);
    });
  });

  describe('fetchUser', () => {
    it('200 → user', async () => {
      fetchMock.mockResolvedValue(jsonResponse({ id: 'u1', status: 'active' }));
      await expect(client.fetchUser('u1')).resolves.toEqual({
        id: 'u1',
        status: 'active',
      });
      expect(urls()[0]).toBe(
        'https://id.test/api/v1/users/u1?include_deleted=true',
      );
    });

    it('id được encode', async () => {
      fetchMock.mockResolvedValue(
        jsonResponse({ id: 'a/b', status: 'active' }),
      );
      await client.fetchUser('a/b');
      expect(urls()[0]).toBe(
        'https://id.test/api/v1/users/a%2Fb?include_deleted=true',
      );
    });

    it('404 {statusCode:404,error:"Not Found"} → null', async () => {
      fetchMock.mockResolvedValue(
        jsonResponse(
          { statusCode: 404, error: 'Not Found', message: 'x' },
          404,
        ),
      );
      await expect(client.fetchUser('u1')).resolves.toBeNull();
    });

    it('404 HTML từ proxy → DIRECTORY_UNAVAILABLE', async () => {
      fetchMock.mockResolvedValue(textResponse(404));
      expect(await errorCode(client.fetchUser('u1'))).toBe(
        'DIRECTORY_UNAVAILABLE',
      );
    });

    it.each([
      [{ statusCode: 404 }],
      [{ error: 'Not Found' }],
      [{ statusCode: '404', error: 'Not Found' }],
      [
        {
          statusCode: 404,
          error: 'Not Found',
          message: 'Cannot GET /api/v1/userz/u1',
        },
      ],
    ])('404 JSON lạ %j → DIRECTORY_UNAVAILABLE', async (body) => {
      fetchMock.mockResolvedValue(jsonResponse(body, 404));
      expect(await errorCode(client.fetchUser('u1'))).toBe(
        'DIRECTORY_UNAVAILABLE',
      );
    });

    it('200 nhưng body không phải user → DIRECTORY_UNAVAILABLE', async () => {
      fetchMock.mockResolvedValue(jsonResponse([{ id: 'u1' }]));
      expect(await errorCode(client.fetchUser('u1'))).toBe(
        'DIRECTORY_UNAVAILABLE',
      );
    });

    it('500 → DIRECTORY_UNAVAILABLE', async () => {
      fetchMock.mockResolvedValue(jsonResponse({}, 500));
      expect(await errorCode(client.fetchUser('u1'))).toBe(
        'DIRECTORY_UNAVAILABLE',
      );
    });

    it('429 ×4 → DIRECTORY_RATE_LIMITED', async () => {
      fetchMock.mockResolvedValue(jsonResponse({}, 429));
      expect(await errorCode(client.fetchUser('u1'))).toBe(
        'DIRECTORY_RATE_LIMITED',
      );
    });
  });

  describe('lỗi chung', () => {
    it('HTTP 200 nhưng body không phải JSON → DIRECTORY_UNAVAILABLE', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        headers: { get: () => null },
        json: () => Promise.reject(new SyntaxError('bad json')),
      });
      expect(await errorCode(client.fetchUsers())).toBe(
        'DIRECTORY_UNAVAILABLE',
      );
    });

    it('401 lần đầu → retry MỘT lần với token force-refresh; vẫn 401 → DIRECTORY_AUTH_FAILED', async () => {
      fetchMock.mockResolvedValue(jsonResponse({}, 401));
      await expect(client.fetchUsers()).rejects.toThrow(BadGatewayException);
      expect(oidc.clientCredentialsToken).toHaveBeenCalledTimes(2);
      expect(oidc.clientCredentialsToken).toHaveBeenNthCalledWith(1, false);
      expect(oidc.clientCredentialsToken).toHaveBeenNthCalledWith(2, true);
    });

    it('401 lần đầu, token mới thành công → trả dữ liệu bình thường', async () => {
      fetchMock
        .mockResolvedValueOnce(jsonResponse({}, 401))
        .mockResolvedValueOnce(jsonResponse([{ id: 'u1', status: 'active' }]));
      const list = await client.fetchUsers();
      expect(list).toEqual([{ id: 'u1', status: 'active' }]);
    });

    it('lỗi mạng → DIRECTORY_UNAVAILABLE', async () => {
      fetchMock.mockRejectedValue(new TypeError('fetch failed'));
      expect(await errorCode(client.fetchUsers())).toBe(
        'DIRECTORY_UNAVAILABLE',
      );
      expect((await errorBody(client.fetchUsers()))?.message).toBe(
        'Không kết nối được danh bạ Tài khoản D&E — thử lại sau.',
      );
    });

    it('HTTP 500 → DIRECTORY_UNAVAILABLE', async () => {
      fetchMock.mockResolvedValue(jsonResponse({}, 500));
      expect(await errorCode(client.fetchUsers())).toBe(
        'DIRECTORY_UNAVAILABLE',
      );
    });
  });
});
