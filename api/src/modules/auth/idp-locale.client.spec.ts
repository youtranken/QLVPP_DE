import {
  IdpLocaleClient,
  parseRetryAfterSec,
  pmhIdApiBase,
} from './idp-locale.client';

// fetch giả — không bao giờ ra mạng thật
function stubFetch(
  status: number,
  body = '',
  headers: Record<string, string> = {},
) {
  const fn = jest
    .fn()
    .mockResolvedValue(new Response(body || null, { status, headers }));
  global.fetch = fn;
  return fn;
}

describe('IdpLocaleClient', () => {
  const realFetch = global.fetch;
  const savedIssuer = process.env.PMH_ISSUER_URL;

  beforeEach(() => {
    process.env.PMH_ISSUER_URL = 'https://id.locale.test:8443/oidc';
  });
  afterEach(() => {
    global.fetch = realFetch;
    if (savedIssuer === undefined) delete process.env.PMH_ISSUER_URL;
    else process.env.PMH_ISSUER_URL = savedIssuer;
  });

  it('PUT {origin}/api/me/locale, Bearer token người dùng, body {locale}, kèm X-PMH-User-IP hợp lệ', async () => {
    const fetchFn = stubFetch(200, '{"locale":"en"}');
    const r = await new IdpLocaleClient().putLocale('at-1', 'en', {
      userIp: '203.0.113.7',
    });
    expect(r).toEqual({ ok: true, locale: 'en' });
    const [url, init] = fetchFn.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://id.locale.test:8443/api/me/locale');
    expect(init.method).toBe('PUT');
    expect(init.body).toBe('{"locale":"en"}');
    expect(init.headers).toMatchObject({
      Authorization: 'Bearer at-1',
      'Content-Type': 'application/json',
      'X-PMH-User-IP': '203.0.113.7',
    });
  });

  it('IP sai định dạng → không gửi header X-PMH-User-IP', async () => {
    const fetchFn = stubFetch(200, '{"locale":"vi"}');
    await new IdpLocaleClient().putLocale('at', 'vi', {
      userIp: '1.2.3.4, 5.6.7.8',
    });
    const init = fetchFn.mock.calls[0][1] as RequestInit;
    expect(init.headers).not.toHaveProperty('X-PMH-User-IP');
  });

  it.each([
    [401, 'unauthorized'],
    [403, 'forbidden'],
    [400, 'invalid_locale'],
    [500, 'unavailable'],
  ])('HTTP %i → %s', async (status, reason) => {
    stubFetch(status, '{}');
    await expect(new IdpLocaleClient().putLocale('at', 'en')).resolves.toEqual({
      ok: false,
      reason,
    });
  });

  it('429 → rate_limited kèm retryAfterSec từ Retry-After', async () => {
    stubFetch(429, '{"error":"rate_limited","retryAfter":30}', {
      'Retry-After': '30',
    });
    await expect(new IdpLocaleClient().putLocale('at', 'en')).resolves.toEqual({
      ok: false,
      reason: 'rate_limited',
      retryAfterSec: 30,
    });
  });

  it('lỗi mạng → unavailable, không ném', async () => {
    global.fetch = jest.fn().mockRejectedValue(new TypeError('fetch failed'));
    await expect(new IdpLocaleClient().putLocale('at', 'en')).resolves.toEqual({
      ok: false,
      reason: 'unavailable',
    });
  });

  it('thiếu PMH_ISSUER_URL → unavailable, không gọi fetch', async () => {
    delete process.env.PMH_ISSUER_URL;
    const fetchFn = stubFetch(200);
    await expect(new IdpLocaleClient().putLocale('at', 'en')).resolves.toEqual({
      ok: false,
      reason: 'unavailable',
    });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('200 body lạ → ok, locale undefined', async () => {
    stubFetch(200, 'không phải json');
    await expect(new IdpLocaleClient().putLocale('at', 'en')).resolves.toEqual({
      ok: true,
      locale: undefined,
    });
  });
});

describe('pmhIdApiBase / parseRetryAfterSec', () => {
  it('origin của issuer; hỏng → null', () => {
    process.env.PMH_ISSUER_URL = 'https://a.test/oidc';
    expect(pmhIdApiBase()).toBe('https://a.test');
    process.env.PMH_ISSUER_URL = 'không-phải-url';
    expect(pmhIdApiBase()).toBeNull();
    delete process.env.PMH_ISSUER_URL;
  });

  it('giây, HTTP-date, rỗng/hỏng', () => {
    const now = Date.parse('2026-11-10T00:00:00Z');
    expect(parseRetryAfterSec('5', now)).toBe(5);
    expect(parseRetryAfterSec('1.5', now)).toBe(2);
    expect(parseRetryAfterSec('Tue, 10 Nov 2026 00:00:10 GMT', now)).toBe(10);
    expect(parseRetryAfterSec('', now)).toBeUndefined();
    expect(parseRetryAfterSec('-5', now)).toBeUndefined();
    expect(parseRetryAfterSec(null, now)).toBeUndefined();
  });
});
