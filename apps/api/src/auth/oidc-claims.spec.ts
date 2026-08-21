import { describe, expect, it } from 'vitest';
import type { TokenSet } from 'openid-client';
import { OidcService } from './oidc.service';

/**
 * `extractClaims` chỉ đọc `tokenSet.claims()` nên dựng được token giả rất gọn —
 * không cần dựng cả IdP. Điều đang bảo vệ: PMH ID CÓ phát claim `department`
 * (nó nằm trong `claims_supported`), mà trước đây app bỏ qua hoàn toàn nên tài
 * khoản thật luôn rơi vào nhánh suy-từ-groups và thường ra rỗng.
 */
function fakeToken(claims: Record<string, unknown>): TokenSet {
  return { claims: () => claims } as unknown as TokenSet;
}

const service = new OidcService();

describe('extractClaims — claim department', () => {
  it('lấy department PMH ID khai thẳng trong token', () => {
    const c = service.extractClaims(
      fakeToken({ sub: 'u1', department: 'Phòng Công trình', groups: ['Test_VPP'] }),
    );
    expect(c.department).toBe('Phòng Công trình');
  });

  it('cắt khoảng trắng thừa', () => {
    const c = service.extractClaims(fakeToken({ sub: 'u1', department: '  Kế toán  ' }));
    expect(c.department).toBe('Kế toán');
  });

  it('IdP không phát claim ⇒ null, để phần suy từ groups làm việc', () => {
    const c = service.extractClaims(fakeToken({ sub: 'u1', groups: ['Kỹ thuật'] }));
    expect(c.department).toBeNull();
  });

  it('chuỗi rỗng/toàn khoảng trắng cũng coi như không có', () => {
    expect(service.extractClaims(fakeToken({ sub: 'u1', department: '' })).department).toBeNull();
    expect(
      service.extractClaims(fakeToken({ sub: 'u1', department: '   ' })).department,
    ).toBeNull();
  });

  it('kiểu không phải chuỗi ⇒ null, không ném lỗi', () => {
    expect(service.extractClaims(fakeToken({ sub: 'u1', department: 42 })).department).toBeNull();
    expect(service.extractClaims(fakeToken({ sub: 'u1', department: null })).department).toBeNull();
  });

  it('vẫn rút đúng các claim cũ', () => {
    const c = service.extractClaims(
      fakeToken({
        sub: 'a771c2a2',
        email: 'huuthong@pmh.com.vn',
        full_name: 'Hữu Thông',
        employee_code: '200',
        groups: ['Test_VPP'],
      }),
    );
    expect(c).toMatchObject({
      sub: 'a771c2a2',
      email: 'huuthong@pmh.com.vn',
      name: 'Hữu Thông',
      employeeCode: '200',
      groups: ['Test_VPP'],
    });
  });
});
