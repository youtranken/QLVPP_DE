import { assertTrustProxyHops } from './trust-proxy';

describe('assertTrustProxyHops', () => {
  it.each(['0', '1', '2', '5'])('"%s" hợp lệ → trả số', (raw) => {
    expect(assertTrustProxyHops({ TRUST_PROXY_HOPS: raw })).toBe(Number(raw));
  });

  it.each([undefined, '', '6', '-1', '1.5', 'abc', ' 2', 'true'])(
    '%p → từ chối khởi động',
    (raw) => {
      expect(() => assertTrustProxyHops({ TRUST_PROXY_HOPS: raw })).toThrow(
        /TRUST_PROXY_HOPS/,
      );
    },
  );
});
