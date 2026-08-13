import type { Role } from '@vpp/shared';

export interface Identity {
  role: Role;
  department: string | null;
  /** true khi user thuộc nhiều group phòng ban — nên ghi audit để admin đối soát (SSO §5). */
  ambiguousDepartment: boolean;
}

export interface GroupMappingOptions {
  /** Group quyết định quyền admin (env `VPP_ADMIN_GROUP`). */
  adminGroup: string;
  /**
   * Group được coi là phòng ban, THEO THỨ TỰ ưu tiên (env `VPP_DEPARTMENT_GROUPS`).
   * Bỏ trống ⇒ lấy group đầu tiên khác `adminGroup`.
   */
  departmentGroups?: readonly string[];
}

/**
 * Map danh sách group PMH ID → vai trò + phòng ban (SSO-INTEGRATION §5).
 * - `role` = 'admin' nếu `groups` chứa `adminGroup`, ngược lại 'member'.
 * - `department` = group phòng ban đầu tiên theo thứ tự `departmentGroups`;
 *   nếu không khai danh sách thì lấy group đầu tiên khác `adminGroup`.
 * - Chỉ có group admin ⇒ `department = null`.
 */
export function mapGroups(groups: string[], options: GroupMappingOptions | string): Identity {
  // Cho phép truyền thẳng adminGroup dạng chuỗi cho trường hợp đơn giản.
  const { adminGroup, departmentGroups = [] } =
    typeof options === 'string' ? { adminGroup: options, departmentGroups: [] } : options;

  const role: Role = groups.includes(adminGroup) ? 'admin' : 'member';
  const candidates = groups.filter((group) => group !== adminGroup);

  if (departmentGroups.length === 0) {
    return {
      role,
      department: candidates[0] ?? null,
      ambiguousDepartment: candidates.length > 1,
    };
  }

  const matched = departmentGroups.filter((group) => candidates.includes(group));
  return {
    role,
    department: matched[0] ?? null,
    ambiguousDepartment: matched.length > 1,
  };
}
