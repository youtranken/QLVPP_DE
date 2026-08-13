/** Vai trò trong app (suy ra từ group PMH ID). */
export const ROLES = ['admin', 'member'] as const;
export type Role = (typeof ROLES)[number];

/** Trạng thái đơn đăng ký. */
export const REQUEST_STATUSES = [
  'submitted',
  'approved',
  'rejected',
  'delivered',
  'cancelled',
] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

/**
 * Trạng thái coi là "đơn đang hiệu lực" — mỗi người chỉ được 1 đơn như vậy mỗi kỳ.
 * Dùng cho partial unique index `(user_id, period)` (SDD §5).
 */
export const ACTIVE_REQUEST_STATUSES = ['submitted', 'approved', 'delivered'] as const;
export type ActiveRequestStatus = (typeof ACTIVE_REQUEST_STATUSES)[number];

/** Nguồn tạo bản ghi user: đăng nhập SSO, hay kéo về từ Directory API (chưa từng đăng nhập). */
export const USER_SOURCES = ['login', 'directory'] as const;
export type UserSource = (typeof USER_SOURCES)[number];
