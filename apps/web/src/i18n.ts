import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

/**
 * Giao diện chỉ có tiếng Việt (NFR-2). Dựng sẵn khung i18next để sau này thêm
 * ngôn ngữ khác chỉ là thêm file resource, không phải sửa từng component.
 */
export const vi = {
  common: {
    appName: 'Đăng ký Văn phòng phẩm',
    loading: 'Đang tải…',
    save: 'Lưu',
    cancel: 'Đóng',
    confirm: 'Xác nhận',
    retry: 'Thử lại',
    error: 'Có lỗi xảy ra',
    empty: 'Chưa có dữ liệu',
  },
  auth: {
    signIn: 'Đăng nhập bằng PMH ID',
    signInHint: 'Hệ thống dùng chung tài khoản PMH ID — không có mật khẩu riêng.',
    signOutLocal: 'Đăng xuất khỏi VPP',
    signOutGlobal: 'Đăng xuất khỏi PMH ID',
    noAccessTitle: 'Bạn chưa được cấp quyền',
    noAccessBody:
      'Tài khoản của bạn chưa được phép dùng hệ thống này. Vui lòng liên hệ quản trị viên.',
    sessionExpired: 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.',
    signInFailed: 'Đăng nhập không thành công, vui lòng thử lại.',
  },
  nav: {
    home: 'Trang chủ',
    register: 'Đăng ký VPP',
    myRequests: 'Đơn của tôi',
    admin: 'Quản trị',
    dashboard: 'Bảng điều khiển',
    adminRequests: 'Duyệt đơn',
    summary: 'Tổng hợp & báo cáo',
    catalog: 'Danh mục VPP',
    directory: 'Danh bạ nhân viên',
    audit: 'Nhật ký',
    handover: 'Phiếu phát hàng',
    settings: 'Cài đặt',
  },
  period: {
    open: 'Đang mở đăng ký',
    closed: 'Đã đóng đăng ký',
    windowHint: 'Nhận đăng ký {{window}} hằng tháng.',
    adminOverride: 'Bạn là quản trị viên nên vẫn đăng ký được ngoài khung ngày.',
  },
  status: {
    submitted: 'Đã gửi',
    approved: 'Đã duyệt',
    rejected: 'Bị từ chối',
    delivered: 'Đã giao',
    cancelled: 'Đã huỷ',
  },
} as const;

void i18n.use(initReactI18next).init({
  resources: { vi: { translation: vi } },
  lng: 'vi',
  fallbackLng: 'vi',
  interpolation: { escapeValue: false }, // React đã tự chống XSS
});

export default i18n;
