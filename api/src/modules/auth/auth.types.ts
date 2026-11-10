export interface MeResponse {
  sub: string;
  role: string;
  devMode: boolean;
  csrfToken: string | null;
  fullName: string | null;
  email: string | null;
  department: string | null;
  employeeCode: string | null;
  // Ngôn ngữ tài khoản PMH ID (claim `locale`, thiếu/lạ → vi); null = phiên không có PMH ID
  // (SA local, tài khoản thử, dev mode) — web giữ ngôn ngữ đang dùng
  locale: 'vi' | 'en' | null;
  // Claim `locale_updated_at` (giây epoch); null = chưa từng đặt / không có
  localeUpdatedAt: number | null;
  // Giờ máy chủ (ms epoch) — web hiệu chỉnh lúc chọn ở màn đăng nhập theo giờ máy chủ
  serverTime: number;
  config: {
    registration_last_day: number;
    default_max_qty: number;
    admin_contact: string;
  };
}
