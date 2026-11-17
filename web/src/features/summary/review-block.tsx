import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMe } from '@/lib/me';
import { useSingleFlight } from '@/lib/use-single-flight';
import { useToast } from '@/ui/toast-context';
import type { LineView } from '@/features/request/request.api';
import { ConvertDialog } from '@/features/review/convert-dialog';
import { RejectDialog } from '@/features/review/reject-dialog';
import { reviewErrorKey } from '@/features/review/review-errors';
import { reviewLine, useReviewCache, type ReviewBody } from '@/features/review/review.api';

type Open = 'convert' | 'reject' | null;

// G8: dòng ngoài DM chờ duyệt — Chấp nhận (tick "Thêm luôn vào danh mục" → điền món mới) hoặc Từ chối (lý do bắt buộc)
export function ReviewBlock({ line, requestUpdatedAt, onDone }: { line: LineView; requestUpdatedAt: string; onDone: () => void }) {
  const { t } = useTranslation();
  const { csrfToken } = useMe();
  const cache = useReviewCache();
  const toast = useToast();
  const flight = useSingleFlight();
  const id = useId();
  const [toCatalog, setToCatalog] = useState(false);
  const [open, setOpen] = useState<Open>(null);
  const [error, setError] = useState<string | null>(null);
  const name = line.custom_name ?? '';
  const send = async (body: ReviewBody) => {
    const result = await reviewLine(line.id, { ...body, expected_updated_at: requestUpdatedAt }, csrfToken);
    // Món trong danh mục khác ĐVT dòng gốc: số lượng có thể cần sửa — dòng đã duyệt thì khối này biến mất nên báo bằng toast
    if (result.unit_mismatch) toast.show({ text: t('review.actions.unitMismatch', { qty: line.qty }), tone: 'warn' });
    void cache.reviewed();
    void cache.refetchList();
    setOpen(null);
    onDone();
  };
  const accept = () =>
    flight.run(async () => {
      setError(null);
      try {
        await send({ action: 'accept' });
      } catch (e) {
        setError(t(reviewErrorKey(e) ?? 'review.errors.UNKNOWN'));
      }
    });
  return (
    <div className="rg-review" role="group" aria-labelledby={`${id}-name`}>
      <span id={`${id}-name`} className="sr-only">
        {name}
      </span>
      <label className="rg-review__catalog">
        <input type="checkbox" checked={toCatalog} onChange={(e) => setToCatalog(e.target.checked)} />
        <span>{t('summary.open.review.toCatalog')}</span>
      </label>
      <div className="rg-review__actions">
        <button type="button" className="btn btn--sm btn--primary" disabled={flight.pending} aria-label={t('summary.open.review.acceptFor', { name })} onClick={() => (toCatalog ? setOpen('convert') : void accept())}>
          {t('summary.open.review.accept')}
        </button>
        <button type="button" className="btn btn--sm" disabled={flight.pending} aria-label={t('summary.open.review.rejectFor', { name })} onClick={() => setOpen('reject')}>
          {t('summary.open.review.reject')}
        </button>
      </div>
      {error && (
        <p role="alert" className="ff-error">
          {error}
        </p>
      )}
      {open === 'convert' && <ConvertDialog line={line} onSubmit={(item) => send({ action: 'convert', item })} onClose={() => setOpen(null)} />}
      {open === 'reject' && <RejectDialog name={name} onSubmit={(note) => send({ action: 'reject', note })} onClose={() => setOpen(null)} />}
    </div>
  );
}
