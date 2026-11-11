import { Children, type ReactNode } from 'react';

// label: hàng thẻ dùng làm bộ lọc thì gom thành một nhóm có tên cho trình đọc màn hình
export function StatRow({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <div className="stat-row" data-count={Children.toArray(children).length} role={label ? 'group' : undefined} aria-label={label}>
      {children}
    </div>
  );
}
