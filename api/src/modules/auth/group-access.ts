// So khớp không phân biệt hoa/thường để lệch cấu hình không khóa nhầm người.
export function intersectsCI(
  userGroups: string[] | undefined,
  allowed: string[],
): boolean {
  if (!userGroups || userGroups.length === 0 || allowed.length === 0) {
    return false;
  }
  const allowedLower = new Set(allowed.map((g) => g.toLowerCase()));
  return userGroups.some(
    (g) => typeof g === 'string' && allowedLower.has(g.toLowerCase()),
  );
}
