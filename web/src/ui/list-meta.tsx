import type { ReactNode } from 'react';

// Số dòng đang hiện + "Đang lọc … · Bỏ lọc" đứng cuối hàng lọc (căn phải) thay vì chiếm một hàng riêng trên bảng.
// Điện thoại: tự xuống một hàng riêng dưới ô lọc.
export function ListMeta({ children }: { children: ReactNode }) {
  return <div className="list-meta">{children}</div>;
}
