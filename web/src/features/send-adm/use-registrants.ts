import { useMemo } from 'react';
import { useItemRows } from '@/features/summary/summary.api';

// Số người đăng ký từng món lấy từ Tổng hợp theo món (cùng khóa với báo cáo); lỗi tải thì chỉ không có liên kết
export function useRegistrants(ym: string) {
  const rows = useItemRows(ym);
  return useMemo(() => new Map((rows.data?.items ?? []).map((r) => [r.key, r.people])), [rows.data]);
}
