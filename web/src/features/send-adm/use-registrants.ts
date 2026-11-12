import { useMemo } from 'react';
import { useItemRows } from '@/features/summary/summary.api';

// Số người đăng ký từng món lấy từ Tổng hợp theo món (cùng khóa với báo cáo).
// map = null khi chưa có số (đang tải hoặc lỗi): ô "Ai đăng ký" không được hiện "—" lúc đó,
// vì "—" nghĩa là không ai đăng ký — lỗi tải (vd 429) trước đây trông y như món không có người
export function useRegistrants(ym: string) {
  const rows = useItemRows(ym);
  const map = useMemo(() => (rows.data ? new Map(rows.data.items.map((r) => [r.key, r.people])) : null), [rows.data]);
  return { map, failed: rows.isError && !rows.data, retry: () => void rows.refetch() };
}
