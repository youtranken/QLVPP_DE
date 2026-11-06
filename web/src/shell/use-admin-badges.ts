import { useQuery } from '@tanstack/react-query';
import { shiftYm } from '@/lib/ym';
import { currentPeriodQuery } from '@/features/request/request.api';
import { REVIEW_BADGE_KEY, reviewLinesQuery } from '@/features/review/review.api';
import { deliveryPeopleQuery } from '@/features/delivery/people/delivery-people.api';
import { lowStockQuery } from '@/features/stock/stock.api';
import type { AdminBadgeKey } from '@/shell/admin-nav';

export const BADGE_FRESH = { staleTime: 60_000, refetchOnWindowFocus: true } as const;

const countOf = (n: unknown): number | undefined => (typeof n === 'number' && Number.isFinite(n) ? n : undefined);

export type AdminBadges = Record<AdminBadgeKey, number | undefined>;

// Lỗi tải đếm chỉ làm mất số, không chặn sidebar; dữ liệu lạ cũng coi như không có số
export function useAdminBadges(): AdminBadges {
  const review = useQuery({ ...reviewLinesQuery('pending', ''), queryKey: [...REVIEW_BADGE_KEY], ...BADGE_FRESH });
  const period = useQuery({ ...currentPeriodQuery(), ...BADGE_FRESH });
  const lockedYm = period.data?.ym ? shiftYm(period.data.ym, -1) : undefined;
  const people = useQuery({ ...deliveryPeopleQuery(lockedYm), ...BADGE_FRESH });
  const stock = useQuery({ ...lowStockQuery(), ...BADGE_FRESH });
  return {
    review: review.isError ? undefined : countOf(review.data?.items?.length),
    // Số người giao được ngay từ tủ/hàng đã về (tủ trống sau khóa sổ → 0); 409 kỳ chưa khóa hay lỗi khác → không có số
    delivery: people.isError || !Array.isArray(people.data?.people) ? undefined : people.data.people.filter((p) => p.deliverable_now).length,
    stock: stock.isError || !Array.isArray(stock.data) ? undefined : stock.data.length,
  };
}
