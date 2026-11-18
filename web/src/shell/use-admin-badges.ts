import { useQuery } from '@tanstack/react-query';
import { lockedYm } from '@/lib/ym';
import { currentPeriodQuery } from '@/features/request/request.api';
import { REVIEW_BADGE_KEY, reviewLinesQuery, type ReviewRow } from '@/features/review/review.api';
import { deliveryPeopleQuery } from '@/features/delivery/people/delivery-people.api';
import { isOwing } from '@/features/delivery/people/people-tabs';
import { stockListQuery } from '@/features/stock/stock.api';
import { shortCount } from '@/features/stock/stock-rows';
import type { AdminBadgeKey } from '@/shell/admin-nav';

export const BADGE_FRESH = { staleTime: 60_000, refetchOnWindowFocus: true } as const;

const countOf = (n: unknown): number | undefined => (typeof n === 'number' && Number.isFinite(n) ? n : undefined);

export type AdminBadges = Record<AdminBadgeKey, number | undefined> & { links: Partial<Record<AdminBadgeKey, string>> };

// Server trả theo kỳ tăng dần: số = người có món chờ ở kỳ cũ nhất, đúng số chip "Có món chờ duyệt" khi mở kỳ đó
export function reviewBadge(items: Pick<ReviewRow, 'period_ym' | 'user_sub'>[]): { n: number; link?: string } {
  const ym = items[0]?.period_ym;
  if (!ym) return { n: 0 };
  const people = new Set(items.filter((r) => r.period_ym === ym).map((r) => r.user_sub));
  return { n: people.size, link: `/admin/month?${new URLSearchParams({ ym, chip: 'pending' })}` };
}

// Lỗi tải đếm chỉ làm mất số, không chặn sidebar; dữ liệu lạ cũng coi như không có số
export function useAdminBadges(): AdminBadges {
  const review = useQuery({ ...reviewLinesQuery('pending', ''), queryKey: [...REVIEW_BADGE_KEY], ...BADGE_FRESH });
  const period = useQuery({ ...currentPeriodQuery(), ...BADGE_FRESH });
  const workingYm = period.data?.ym ? lockedYm(period.data.ym) : undefined;
  const people = useQuery({ ...deliveryPeopleQuery(workingYm), ...BADGE_FRESH });
  const stock = useQuery({ ...stockListQuery(), ...BADGE_FRESH });
  const pending = !review.isError && Array.isArray(review.data?.items) ? reviewBadge(review.data.items) : undefined;
  return {
    review: countOf(pending?.n),
    // Cùng số thẻ "Chưa nhận" đang sáng khi mở Giao hàng; 409 kỳ chưa khóa hay lỗi khác → không có số
    delivery: people.isError || !Array.isArray(people.data?.people) ? undefined : people.data.people.filter(isOwing).length,
    // Chỉ món người chờ còn thiếu sau khi tính hàng đang về; "Không có"/"Sắp hết" không đếm
    stock: stock.isError || !Array.isArray(stock.data) ? undefined : shortCount(stock.data),
    links: pending?.link ? { review: pending.link } : {},
  };
}
