import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'vpp:is_public';

export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const IS_OPTIONAL_AUTH_KEY = 'vpp:optional_auth';

/**
 * Route đọc phiên nếu có, KHÔNG 401 khi chưa đăng nhập (handler tự trả lời ẩn danh). Khác @Public: phiên lỗi vẫn xử lý
 * như route thường — PMH ID sập thì 503 SSO_UNAVAILABLE, phiên hết hạn/bị thu hồi thì xóa cookie. Chỉ dùng cho boot web.
 */
export const OptionalAuth = () => SetMetadata(IS_OPTIONAL_AUTH_KEY, true);
