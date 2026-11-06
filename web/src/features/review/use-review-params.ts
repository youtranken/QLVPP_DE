import { useCallback, useEffect } from 'react';
import { useUrlPatch } from '@/lib/use-url-patch';
import { YM, lockedYm } from '@/lib/ym';
import { REVIEW_FILTERS, type ReviewFilter } from './review.api';

const isFilter = (s: string | null): s is ReviewFilter => REVIEW_FILTERS.includes(s as ReviewFilter);

// ?status= lạ về "pending", ?ym= sai mẫu bị bỏ; URL chỉ ghi giá trị khác mặc định (tương thích liên kết từ ngăn Điều chỉnh)
export function useReviewParams(openYm: string | undefined) {
  const [params, patchUrl] = useUrlPatch();
  const askedStatus = params.get('status');
  const status: ReviewFilter = isFilter(askedStatus) ? askedStatus : 'pending';
  const askedYm = params.get('ym') ?? '';
  const valid = YM.test(askedYm) ? askedYm : '';
  // Kỳ mở hoặc tương lai chưa xem được: thay bằng kỳ khóa gần nhất (banner nói rõ lý do), không đổi âm thầm
  const ym = valid && openYm && valid >= openYm ? lockedYm(openYm) : valid;

  useEffect(() => {
    if (ym && askedYm !== ym) patchUrl({ ym }, true);
  }, [ym, askedYm, patchUrl]);

  const update = useCallback(
    (next: { status?: ReviewFilter; ym?: string }) => {
      const s = next.status ?? status;
      const y = next.ym ?? ym;
      patchUrl({ status: s !== 'pending' ? s : null, ym: y || null });
    },
    [patchUrl, status, ym],
  );

  return { status, ym, setStatus: (s: ReviewFilter) => update({ status: s }), setMonth: (y: string) => update({ ym: y }) };
}
