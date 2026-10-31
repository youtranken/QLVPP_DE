import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { YM } from '@/lib/ym';
import { REVIEW_FILTERS, type ReviewFilter } from './review.api';

const isFilter = (s: string | null): s is ReviewFilter => REVIEW_FILTERS.includes(s as ReviewFilter);

// ?status= lạ về "pending", ?ym= sai mẫu bị bỏ; URL chỉ ghi giá trị khác mặc định (tương thích liên kết từ ngăn Điều chỉnh)
export function useReviewParams() {
  const [params, setParams] = useSearchParams();
  const askedStatus = params.get('status');
  const status: ReviewFilter = isFilter(askedStatus) ? askedStatus : 'pending';
  const askedYm = params.get('ym') ?? '';
  const ym = YM.test(askedYm) ? askedYm : '';

  const update = useCallback(
    (next: { status?: ReviewFilter; ym?: string }) => {
      const s = next.status ?? status;
      const y = next.ym ?? ym;
      setParams({ ...(s !== 'pending' ? { status: s } : {}), ...(y ? { ym: y } : {}) });
    },
    [setParams, status, ym],
  );

  return { status, ym, setStatus: (s: ReviewFilter) => update({ status: s }), setMonth: (y: string) => update({ ym: y }) };
}
