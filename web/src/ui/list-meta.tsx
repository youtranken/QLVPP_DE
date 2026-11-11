import type { ReactNode } from 'react';

// Dòng đếm riêng một hàng đẩy bảng xuống và tách xa bộ lọc sinh ra nó; nằm cuối hàng lọc thì đọc liền với điều kiện lọc
export function ListMeta({ children }: { children: ReactNode }) {
  return <div className="list-meta">{children}</div>;
}
