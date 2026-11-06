import type { ReactNode } from 'react';

// Khung trống chung của trang quản trị: rộng hết vùng danh sách, khối chữ tối đa 480 px căn giữa
export function EmptyFrame({ art, title, hint, action }: { art?: ReactNode; title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="empty-state">
      <div className="empty-state__body">
        {art}
        <h2 className="empty-state__title">{title}</h2>
        {hint && <p className="empty-state__hint">{hint}</p>}
        {action}
      </div>
    </div>
  );
}
