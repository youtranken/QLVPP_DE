import { describe, expect, it } from 'vitest';
import { normalizeDirectoryUser, parseDirectoryPage, webhookTimestampToMs } from './pmh-payload';

/**
 * Dữ liệu trong file này lấy theo ĐÚNG hình dạng PMH ID thật phát ra, đọc từ
 * `sso-server`:
 *   - danh bạ: `directory.service.ts` trả thẳng `rows` (mảng), cột
 *     `id, employee_code, email, full_name, status, groups`
 *   - webhook: `webhook-worker.service.ts` gửi `X-PMH-Timestamp` tính bằng GIÂY
 * Trước đây VPP viết theo mock-idp nên cả ba chỗ đều lệch.
 */

describe('parseDirectoryPage', () => {
  it('PMH ID trả MẢNG THUẦN', () => {
    const rows = [{ id: 'u1' }, { id: 'u2' }];
    expect(parseDirectoryPage(rows)).toHaveLength(2);
  });

  it('mock-idp bọc trong { items }', () => {
    expect(parseDirectoryPage({ total: 1, items: [{ sub: 'u1' }] })).toHaveLength(1);
  });

  it('hình dạng lạ ⇒ mảng rỗng, không ném lỗi', () => {
    expect(parseDirectoryPage(null)).toEqual([]);
    expect(parseDirectoryPage({})).toEqual([]);
    expect(parseDirectoryPage({ items: 'không phải mảng' })).toEqual([]);
    expect(parseDirectoryPage('rác')).toEqual([]);
  });
});

describe('normalizeDirectoryUser', () => {
  it('bản ghi PMH ID thật: id → sub, status active → không khoá', () => {
    expect(
      normalizeDirectoryUser({
        id: 'a771c2a2-5bd4-4bca-80a1-3dd35572a43e',
        employee_code: '200',
        email: 'huuthong@pmh.com.vn',
        full_name: 'Hữu Thông',
        status: 'active',
        groups: ['Test_VPP'],
      }),
    ).toEqual({
      sub: 'a771c2a2-5bd4-4bca-80a1-3dd35572a43e',
      email: 'huuthong@pmh.com.vn',
      full_name: 'Hữu Thông',
      employee_code: '200',
      groups: ['Test_VPP'],
      disabled: false,
    });
  });

  it('status locked / deleted ⇒ coi là bị khoá', () => {
    expect(normalizeDirectoryUser({ id: 'u1', status: 'locked' })?.disabled).toBe(true);
    expect(normalizeDirectoryUser({ id: 'u1', status: 'deleted' })?.disabled).toBe(true);
  });

  it('bản ghi mock-idp: sub + disabled vẫn dùng được', () => {
    const u = normalizeDirectoryUser({ sub: 'usr_an', disabled: true, groups: ['Kinh doanh'] });
    expect(u?.sub).toBe('usr_an');
    expect(u?.disabled).toBe(true);
  });

  it('`disabled` tường minh thắng `status`', () => {
    expect(normalizeDirectoryUser({ id: 'u1', status: 'locked', disabled: false })?.disabled).toBe(
      false,
    );
  });

  it('thiếu cả sub lẫn id ⇒ null (không có khoá để upsert)', () => {
    expect(normalizeDirectoryUser({ email: 'x@pmh.com.vn' })).toBeNull();
  });

  it('thiếu groups ⇒ mảng rỗng, không phải undefined', () => {
    expect(normalizeDirectoryUser({ id: 'u1' })?.groups).toEqual([]);
  });
});

describe('webhookTimestampToMs', () => {
  it('PMH ID gửi GIÂY ⇒ nhân lên 1000', () => {
    expect(webhookTimestampToMs('1787000000')).toBe(1787000000000);
  });

  it('mock-idp gửi MILLI GIÂY ⇒ giữ nguyên', () => {
    expect(webhookTimestampToMs('1787000000000')).toBe(1787000000000);
  });

  it('gói thật của PMH ID lọt cửa sổ 5 phút', () => {
    const nowSeconds = Math.floor(Date.now() / 1000).toString();
    expect(Math.abs(Date.now() - (webhookTimestampToMs(nowSeconds) as number))).toBeLessThan(
      5 * 60 * 1000,
    );
  });

  it('giá trị rác ⇒ null', () => {
    expect(webhookTimestampToMs('không phải số')).toBeNull();
    expect(webhookTimestampToMs('')).toBeNull();
    expect(webhookTimestampToMs('0')).toBeNull();
    expect(webhookTimestampToMs('-5')).toBeNull();
  });
});
