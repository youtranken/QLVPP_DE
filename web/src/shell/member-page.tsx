import type { ReactNode } from 'react';

// Khung trang Nhân viên v2: tiêu đề trên nền teal, nội dung (cả tải/lỗi) trong panel sáng
export function MemberPage({
  title,
  subtitle,
  back,
  children,
}: {
  title?: string;
  subtitle?: string;
  back?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="m-page m-page--plain">
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
