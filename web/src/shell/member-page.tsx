import type { ReactNode } from 'react';

// Khung trang Nhân viên v2: tiêu đề trên nền teal, nội dung (cả tải/lỗi) trong panel sáng
export function MemberPage({
  title,
  subtitle,
  back,
  wide = false,
  children,
}: {
  title?: string;
  subtitle?: string;
  back?: ReactNode;
  // Trang dùng hết bề ngang (Lịch sử master–detail)
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={`m-page m-page--plain${wide ? ' m-page--wide' : ''}`}>
      {(title || back) && (
        <div className="m-head">
          {back}
          {title && <h1>{title}</h1>}
          {subtitle && <p>{subtitle}</p>}
        </div>
      )}
      <div className="m-panel m-panel--stack">{children}</div>
    </div>
  );
}

// Khung chờ/lỗi của trang Đăng ký (chưa có tiêu đề); cũng là khung chờ khi chunk trang nhân viên còn đang nạp
export function LoadPanel({ children }: { children: ReactNode }) {
  return (
    <div className="m-page">
      <div className="m-panel">{children}</div>
    </div>
  );
}
