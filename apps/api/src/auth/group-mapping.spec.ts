import { DEFAULT_ADMIN_GROUP } from '@vpp/shared';
import { describe, expect, it } from 'vitest';
import { mapGroups } from './group-mapping';

const DEPARTMENTS = ['Hành chính', 'Nhân sự', 'Kế toán', 'Kỹ thuật', 'Kinh doanh'];

describe('mapGroups — không khai danh sách phòng ban', () => {
  it('có group admin ⇒ role admin + phòng ban đầu tiên', () => {
    const id = mapGroups([DEFAULT_ADMIN_GROUP, 'Hành chính'], DEFAULT_ADMIN_GROUP);
    expect(id.role).toBe('admin');
    expect(id.department).toBe('Hành chính');
  });

  it('không có group admin ⇒ member', () => {
    const id = mapGroups(['Kế toán'], DEFAULT_ADMIN_GROUP);
    expect(id.role).toBe('member');
    expect(id.department).toBe('Kế toán');
  });

  it('chỉ có group admin ⇒ không phòng ban', () => {
    const id = mapGroups([DEFAULT_ADMIN_GROUP], DEFAULT_ADMIN_GROUP);
    expect(id.role).toBe('admin');
    expect(id.department).toBeNull();
  });
});

describe('mapGroups — có khai VPP_DEPARTMENT_GROUPS', () => {
  const options = { adminGroup: DEFAULT_ADMIN_GROUP, departmentGroups: DEPARTMENTS };

  it('lấy phòng ban theo THỨ TỰ khai báo, không theo thứ tự group của user', () => {
    const id = mapGroups(['Kinh doanh', 'Kế toán'], options);
    expect(id.department).toBe('Kế toán'); // 'Kế toán' đứng trước 'Kinh doanh' trong danh sách
    expect(id.ambiguousDepartment).toBe(true);
  });

  it('bỏ qua group lạ không nằm trong danh sách phòng ban', () => {
    const id = mapGroups(['Nhóm-Dự-Án-X', 'Kỹ thuật'], options);
    expect(id.department).toBe('Kỹ thuật');
    expect(id.ambiguousDepartment).toBe(false);
  });

  it('không group nào là phòng ban ⇒ null', () => {
    const id = mapGroups([DEFAULT_ADMIN_GROUP, 'Nhóm-Dự-Án-X'], options);
    expect(id.role).toBe('admin');
    expect(id.department).toBeNull();
  });

  it('một phòng ban duy nhất ⇒ không coi là mập mờ', () => {
    const id = mapGroups(['Nhân sự'], options);
    expect(id.department).toBe('Nhân sự');
    expect(id.ambiguousDepartment).toBe(false);
  });
});
