import { assertEncKeyEnv } from './crypto-secret';

describe('assertEncKeyEnv — CONFIG_ENC_KEY lúc khởi động', () => {
  const good = 'k'.repeat(32);

  it('production thiếu khóa → ném (fail-closed)', () => {
    expect(() => assertEncKeyEnv({ NODE_ENV: 'production' })).toThrow(
      /Thiếu CONFIG_ENC_KEY/,
    );
    expect(() =>
      assertEncKeyEnv({ NODE_ENV: 'production', CONFIG_ENC_KEY: '' }),
    ).toThrow(/Thiếu CONFIG_ENC_KEY/);
  });

  it('development/test thiếu khóa → cho chạy (token lưu p:)', () => {
    expect(() => assertEncKeyEnv({ NODE_ENV: 'development' })).not.toThrow();
    expect(() => assertEncKeyEnv({ NODE_ENV: 'test' })).not.toThrow();
  });

  it('khóa < 32 ký tự hoặc còn CHANGE_ME → ném ở mọi môi trường', () => {
    for (const NODE_ENV of ['production', 'development']) {
      expect(() =>
        assertEncKeyEnv({ NODE_ENV, CONFIG_ENC_KEY: 'k'.repeat(31) }),
      ).toThrow(/≥ 32/);
      expect(() =>
        assertEncKeyEnv({
          NODE_ENV,
          CONFIG_ENC_KEY: 'CHANGE_ME_openssl_rand_base64_32_xx',
        }),
      ).toThrow(/placeholder/);
    }
  });

  it('khóa đủ dài → qua', () => {
    expect(() =>
      assertEncKeyEnv({ NODE_ENV: 'production', CONFIG_ENC_KEY: good }),
    ).not.toThrow();
  });
});
