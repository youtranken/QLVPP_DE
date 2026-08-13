import { describe, expect, it, vi } from 'vitest';
import { parseEnv, parseToolEnv } from './env';

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

/** Cấu hình production hợp lệ tối thiểu, dùng làm nền cho các phép kiểm bên dưới. */
const VALID_PRODUCTION = {
  NODE_ENV: 'production',
  APP_BASE_URL: 'https://de-vpp.pmh.com.vn',
  WEB_ORIGIN: 'https://de-vpp.pmh.com.vn',
  OIDC_ISSUER: 'https://de-admin.pmh.com.vn/oidc',
  PMH_CLIENT_SECRET: 'x'.repeat(32),
  PMH_WEBHOOK_SECRET: 'y'.repeat(32),
  PMH_M2M_CLIENT_SECRET: 'z'.repeat(32),
  SESSION_SECRET: 'w'.repeat(32),
  ORG_NAME: 'CÔNG TY PMH',
} satisfies NodeJS.ProcessEnv;

describe('chốt an toàn cho production', () => {
  it('cấu hình prod đầy đủ thì chạy được', () => {
    expect(() => parseEnv(VALID_PRODUCTION)).not.toThrow();
  });

  it.each([
    ['PMH_CLIENT_SECRET', 'dev-secret-change-me'],
    ['PMH_WEBHOOK_SECRET', 'dev-webhook-secret-change-me'],
    ['PMH_M2M_CLIENT_SECRET', 'dev-m2m-secret-change-me'],
    ['SESSION_SECRET', 'dev-session-secret-change-me'],
  ])('chặn khởi động khi %s còn là giá trị mặc định của dev', (key, value) => {
    expect(() => parseEnv({ ...VALID_PRODUCTION, [key]: value })).toThrow(
      /Cấu hình production không an toàn/,
    );
  });

  it('chặn bí mật quá ngắn', () => {
    expect(() => parseEnv({ ...VALID_PRODUCTION, SESSION_SECRET: 'ngan' })).toThrow(/quá ngắn/);
  });

  it('chặn APP_BASE_URL không phải https (cookie secure sẽ bị bỏ)', () => {
    expect(() =>
      parseEnv({ ...VALID_PRODUCTION, APP_BASE_URL: 'http://de-vpp.pmh.com.vn' }),
    ).toThrow(/APP_BASE_URL phải là https/);
  });

  it('chặn OIDC_ISSUER không phải https', () => {
    expect(() => parseEnv({ ...VALID_PRODUCTION, OIDC_ISSUER: 'http://idp.local/oidc' })).toThrow(
      /OIDC_ISSUER phải là https/,
    );
  });

  it('chặn khi ORG_NAME còn là giá trị đặt chỗ', () => {
    expect(() => parseEnv({ ...VALID_PRODUCTION, ORG_NAME: 'CÔNG TY' })).toThrow(/ORG_NAME/);
  });

  it('ALLOW_INSECURE_PRODUCTION=1 thì vẫn chạy nhưng phải cảnh báo', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(() =>
      parseEnv({
        ...VALID_PRODUCTION,
        APP_BASE_URL: 'http://staging.local',
        ALLOW_INSECURE_PRODUCTION: '1',
      }),
    ).not.toThrow();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('KHÔNG an toàn'));
    warn.mockRestore();
  });

  it('không áp chốt này cho development', () => {
    expect(() => parseEnv({ NODE_ENV: 'development' })).not.toThrow();
  });
});

describe('parseToolEnv (migrate / seed)', () => {
  it('KHÔNG áp chốt production — migrate chỉ cần DATABASE_URL', () => {
    // Image api đặt sẵn NODE_ENV=production, còn service migrate chỉ nhận
    // DATABASE_URL. Nếu công cụ cũng bị bắt kiểm cấu hình SSO thì mọi lần triển
    // khai production đều hỏng ngay ở bước migrate.
    expect(() =>
      parseToolEnv({ NODE_ENV: 'production', DATABASE_URL: 'postgres://u:p@db:5432/vpp' }),
    ).not.toThrow();
  });

  it('trả về cả cấu hình ánh xạ nhóm cho seed demo', () => {
    const cfg = parseToolEnv({
      DATABASE_URL: 'postgres://u:p@db:5432/vpp',
      VPP_DEPARTMENT_GROUPS: 'Kế toán, Kỹ thuật',
    });
    expect(cfg.VPP_ADMIN_GROUP).toBe('VPP-Admin');
    expect(cfg.VPP_DEPARTMENT_GROUPS).toEqual(['Kế toán', 'Kỹ thuật']);
  });
});
