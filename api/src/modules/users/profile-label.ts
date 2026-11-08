import { TEAM_MAX } from '../auth/auth-env';

// Nhãn Phòng/Nhóm từ token và Directory chuẩn hóa chung một hàm, để đăng nhập và đồng bộ
// không ghi qua lại hai bản khác nhau. department "" và team null đều thành undefined → NULL.
export function toLabel(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  // NUL làm Postgres từ chối text (22021)
  // eslint-disable-next-line no-control-regex
  const clean = value.replace(/[\u0000-\u001f\u007f]/g, '').trim();
  return Array.from(clean).slice(0, TEAM_MAX).join('').trim() || undefined;
}
