import { resolveRole } from './role';

describe('resolveRole — admin khi groups ∩ admin_group, không phân biệt hoa thường', () => {
  it("['VPP-Admin'] với admin_group 'vpp-admin' → admin", () => {
    expect(resolveRole(['VPP-Admin'], 'vpp-admin')).toBe('admin');
  });

  it("['x'] với admin_group 'vpp-admin' → member", () => {
    expect(resolveRole(['x'], 'vpp-admin')).toBe('member');
  });

  it('groups rỗng → member', () => {
    expect(resolveRole([], 'vpp-admin')).toBe('member');
  });
});
