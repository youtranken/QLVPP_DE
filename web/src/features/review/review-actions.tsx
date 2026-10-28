import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMe } from '@/lib/me';
import { ConfirmDialog } from '@/ui/confirm-dialog';
import type { LineView } from '@/features/request/request.api';
import { reviewLine, useReviewCache, type ReviewBody, type ReviewResult, type ReviewableLine } from './review.api';

export type { ReviewableLine };
import { isStaleReview, reviewErrorKey } from './review-errors';
import { ConvertDialog } from './convert-dialog';
import { RejectDialog } from './reject-dialog';

type Open = 'accept' | 'convert' | 'reject' | null;

export function ReviewStatusTag({ status, note }: { status: LineView['review_status']; note: string | null }) {
  const { t } = useTranslation();
  if (status === 'rejected') {
    const reason = note?.trim();
    return <span className="tag tag--danger">{reason ? t('review.status.rejectedWhy', { reason }) : t('review.status.rejected')}</span>;
  }
  if (status !== 'accepted' && status !== 'converted') return null;
  return <span className="tag tag--ok">{t(`review.status.${status}`)}</span>;
}

// onDone nhận cả request_updated_at: ngăn điều chỉnh (E3-S3) cập nhật expected_updated_at theo đó
export function ReviewActions({ line, onDone, onStale }: {
  line: ReviewableLine;
  onDone: (result: ReviewResult) => void;
  onStale?: () => void;
}) {
  const { t } = useTranslation();
  const { csrfToken } = useMe();
  const cache = useReviewCache();
  const [open, setOpen] = useState<Open>(null);
  const [result, setResult] = useState<ReviewResult | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [acceptError, setAcceptError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);
  const name = line.custom_name ?? '';
  const status = result?.line.review_status ?? line.review_status;
  const note = result ? result.line.review_note : line.review_note;
  // Nhiều dòng ngoài DM cùng ngăn: tên nút kèm tên dòng để trình đọc màn hình phân biệt
  const named = (action: string) => t('review.actions.named', { action: t(`review.actions.${action}`), name });

  // Lỗi khác "dòng đã đổi" ném lại để hộp đang mở gắn vào ô
  const send = async (body: ReviewBody) => {
    try {
      const done = await reviewLine(line.id, body, csrfToken);
      setResult(done);
      setOpen(null);
      void cache.reviewed();
      onDone(done);
    } catch (e) {
      if (!isStaleReview(e)) throw e;
      setOpen(null);
      setNotice(t(reviewErrorKey(e)!));
      void cache.refetchList();
      onStale?.();
    }
  };

  const accept = async () => {
    setAccepting(true);
    setAcceptError(null);
    try {
      await send({ action: 'accept' });
    } catch (e) {
      setAcceptError(t(reviewErrorKey(e) ?? 'review.errors.UNKNOWN'));
    } finally {
      setAccepting(false);
    }
  };

  return (
    <div className="rv-actions" role="group" aria-label={t('review.actions.label', { name })}>
      {notice && (
        <p role="alert" className="alert alert--warn">
          {notice}
        </p>
      )}
      {result?.unit_mismatch && (
        <p role="status" className="alert alert--warn">
          {t('review.actions.unitMismatch', { qty: result.line.qty })}
        </p>
      )}
      {status !== 'pending' ? (
        <ReviewStatusTag status={status} note={note} />
      ) : (
        <div className="rv-buttons">
          <button type="button" className="btn btn--sm" aria-label={named('accept')} onClick={() => setOpen('accept')}>
            {t('review.actions.accept')}
          </button>
          <button type="button" className="btn btn--sm" aria-label={named('convert')} onClick={() => setOpen('convert')}>
            {t('review.actions.convert')}
          </button>
          <button
            type="button"
            className="btn btn--sm btn--danger-ghost"
            aria-label={named('reject')}
            onClick={() => setOpen('reject')}
          >
            {t('review.actions.reject')}
          </button>
        </div>
      )}
      {open === 'accept' && (
        <ConfirmDialog
          title={t('review.accept.title', { name })}
          message={t('review.accept.body')}
          confirmLabel={t('review.accept.ok')}
          busy={accepting}
          error={acceptError}
          onConfirm={() => void accept()}
          onCancel={() => {
            setOpen(null);
            setAcceptError(null);
          }}
        />
      )}
      {open === 'convert' && (
        <ConvertDialog line={line} onSubmit={(item) => send({ action: 'convert', item })} onClose={() => setOpen(null)} />
      )}
      {open === 'reject' && (
        <RejectDialog name={name} onSubmit={(n) => send({ action: 'reject', note: n })} onClose={() => setOpen(null)} />
      )}
    </div>
  );
}
