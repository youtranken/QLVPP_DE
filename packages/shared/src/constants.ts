/** Mỗi món tối đa 20 (1 món tối đa 20). */
export const MAX_ITEM_QTY = 20;

/**
 * Biên hợp lệ của khung ngày đăng ký. Khung THẬT do admin đặt ở màn Cài đặt và
 * lưu trong CSDL — xem `RegistrationWindow` trong `period.ts`.
 */
export const REG_WINDOW_MIN_DAY = 1;
export const REG_WINDOW_MAX_DAY = 31;

/** Group PMH ID mặc định quyết định quyền admin (có thể ghi đè qua env VPP_ADMIN_GROUP). */
export const DEFAULT_ADMIN_GROUP = 'VPP-Admin';
