import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useUnitName } from '@/features/units/units.api';
import { useMe } from '@/lib/me';
import { ConfirmDialog } from '@/ui/confirm-dialog';
import type { LineView } from '@/features/request/request.api';
import { reviewLine, useReviewCache, type ReviewBody, type ReviewResult, type ReviewableLine } from './review.api';

export type { ReviewableLine };
import { isStaleReview, reviewErrorKey } from './review-errors';
import { ConvertDialog } from './convert-dialog';
import { RejectDialog } from './reject-dialog';
import { sentApplies, type SentInfo, type SentKind } from './review-sent';
import { SentNote } from './review-sent-note';
import './review.m1.css';

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

// onDone nhận cả request_updated_at: ngăn điều chỉnh cập nhật expected_updated_at theo đó
export interface ReviewContext {
  who: string;
  month: number;
}

// 'adjust' (ngăn Điều chỉnh): mặc định mua lần này nên chỉ còn "Thêm vào danh mục" và "Không mua"
export function ReviewActions({ line, context, sent, hideStatus = false, variant = 'full', onDone, onStale }: {
  line: ReviewableLine;
  sent?: SentInfo;
  context?: ReviewContext;
  hideStatus?: boolean;
  variant?: 'full' | 'adjust';
  onDone: (result: ReviewResult, body: ReviewBody) => void;
  onStale?: () => void;
}) {
  const { t } = useTranslation();
  const { csrfToken } = useMe();
  const cache = useReviewCache();
  const [open, setOpen] = useState<Open>(null);
  const [result, setResult] = useState<ReviewResult | null>(null);
  const [acceptError, setAcceptError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);
  const acceptingRef = useRef(false);
  const staleSeen = useRef(false);
  const name = line.custom_name ?? '';
  const unitName = useUnitName(line.custom_unit);
  const status = result?.line.review_status ?? line.review_status;
  const note = result ? result.line.review_note : line.review_note;
  // Nhiều dòng ngoài DM cùng ngăn: tên nút kèm tên dòng để trình đọc màn hình phân biệt
  const sentWarning = (kind: SentKind) => (sentApplies(sent, kind) ? <SentNote sent={sent} kind={kind} unit={unitName} /> : undefined);
  const named = (action: string) => t('review.actions.named', { action: t(`review.actions.${action}`), name });

  // Mọi lỗi ném lại để hộp đang mở gắn vào ô/khối; dòng đã đổi thì nhớ để đóng hộp xong tải lại
  const send = async (body: ReviewBody) => {
    try {
      const done = await reviewLine(line.id, body, csrfToken);
      setResult(done);
      setOpen(null);
      void cache.reviewed();
      onDone(done, body);
    } catch (e) {
      if (isStaleReview(e)) staleSeen.current = true;
      throw e;
    }
  };

  const close = () => {
    setOpen(null);
    setAcceptError(null);
    if (!staleSeen.current) return;
    staleSeen.current = false;
    void cache.refetchList();
    onStale?.();
  };

  const accept = async () => {
    if (acceptingRef.current) return;
    acceptingRef.current = true;
    setAccepting(true);
    setAcceptError(null);
    try {
      await send({ action: 'accept' });
    } catch (e) {
      setAcceptError(t(reviewErrorKey(e) ?? 'review.errors.UNKNOWN'));
    } finally {
      acceptingRef.current = false;
      setAccepting(false);
    }
  };

  return (
    <div className="rv-actions" role="group" aria-label={t('review.actions.label', { name })}>
      {!hideStatus && result?.unit_mismatch && (
        <p role="status" className="alert alert--warn">
          {t('review.actions.unitMismatch', { qty: result.line.qty })}
        </p>
      )}
      {status !== 'pending' ? (
        hideStatus ? null : <ReviewStatusTag status={status} note={note} />
      ) : variant === 'adjust' ? (
        <>
          <p className="rv-default">{t('summary.adjust.customDefault')}</p>
          <div className="rv-buttons rv-buttons--pair">
            <button
              type="button"
              className="btn btn--sm"
              aria-label={t('review.actions.named', { action: t('summary.adjust.addToCatalog'), name })}
              onClick={() => setOpen('convert')}
            >
              {t('summary.adjust.addToCatalog')}
            </button>
            <button type="button" className="btn btn--sm btn--danger-ghost" aria-label={named('reject')} onClick={() => setOpen('reject')}>
              {t('review.actions.reject')}
            </button>
          </div>
        </>
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
          message={
            context
              ? t('review.accept.bodyFor', { qty: line.qty, unit: unitName, month: context.month, who: context.who })
              : t('review.accept.body')
          }
          confirmLabel={t('review.accept.ok')}
          cancelLabel={t('review.back')}
          warning={sentWarning('buy')}
          busy={accepting}
          error={acceptError}
          onConfirm={() => void accept()}
          onCancel={close}
        />
      )}
      {open === 'convert' && (
        <ConvertDialog line={line} who={context?.who} warning={sentWarning('buy')} onSubmit={(item) => send({ action: 'convert', item })} onClose={close} />
      )}
      {open === 'reject' && (
        <RejectDialog name={name} warning={sentWarning('skip')} onSubmit={(n) => send({ action: 'reject', note: n })} onClose={close} />
      )}
    </div>
  );
}
