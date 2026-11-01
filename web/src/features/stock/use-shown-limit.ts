import { useState } from 'react';

export const STOCK_PAGE = 50;

// Về lại 50 món mỗi khi đổi lọc/tìm; tìm kiếm chạy trên toàn bộ món trước khi cắt
export function useShownLimit<T>(rows: T[], viewKey: string) {
  const [more, setMore] = useState({ key: viewKey, limit: STOCK_PAGE });
  const limit = more.key === viewKey ? more.limit : STOCK_PAGE;
  return {
    visible: rows.slice(0, limit),
    hidden: Math.max(0, rows.length - limit),
    total: rows.length,
    showMore: () => setMore({ key: viewKey, limit: limit + STOCK_PAGE }),
  };
}
