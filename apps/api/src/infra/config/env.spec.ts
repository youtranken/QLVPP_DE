import { describe, expect, it } from 'vitest';
import { parseEnv } from './env';

describe('parseEnv', () => {
  it('điền giá trị mặc định khi thiếu biến', () => {
    const cfg = parseEnv({});
    expect(cfg.API_PORT).toBe(3000);
    expect(cfg.NODE_ENV).toBe('development');
    expect(cfg.VPP_ADMIN_GROUP).toBe('VPP-Admin');
  });

  it('ép kiểu số cho API_PORT', () => {
    const cfg = parseEnv({ API_PORT: '4000' });
    expect(cfg.API_PORT).toBe(4000);
  });

  it('báo lỗi khi WEB_ORIGIN không phải URL', () => {
    expect(() => parseEnv({ WEB_ORIGIN: 'not-a-url' })).toThrow(/không hợp lệ/);
  });
});
