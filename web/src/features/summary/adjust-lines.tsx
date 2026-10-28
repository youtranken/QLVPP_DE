import { useId } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Stepper } from '@/ui/stepper';
import { fileUrl } from '@/features/catalog/catalog.api';
import type { LineView } from '@/features/request/request.api';
import { useRequestFormat } from '@/features/request/request-format';
import { ReviewActions } from '@/features/review/review-actions';
import '@/features/review/review.css';
import type { ReviewResult } from '@/features/review/review.api';

export interface QtyProps {
  name: string;
  qty: number;
  min: number;
  max: number;
  delivered?: number;
  cancelled?: number;
  error?: string;
  removed?: boolean;
  readOnly?: boolean;
  onQty: (n: number) => void;
  onRemove?: () => void;
  onRestore?: () => void;
}

const cls = (...names: (string | false | undefined)[]) => names.filter(Boolean).join(' ');

function QtyCell({ name, qty, min, max, delivered = 0, cancelled = 0, error, removed, readOnly, onQty, onRemove, onRestore }: QtyProps) {
  const { t } = useTranslation();
  const id = useId();
  const notes = [
    delivered > 0 && t('summary.adjust.delivered', { n: delivered }),
    cancelled > 0 && t('summary.adjust.cancelled', { n: cancelled }),
  ].filter(Boolean);
  const describedBy = cls(notes.length > 0 && `${id}-note`, error && `${id}-err`) || undefined;
  return (
    <div className="aj-qty-cell">
      <div className="aj-qty">
        {removed || readOnly ? (
          <span className={removed ? 'num aj-removed-qty' : 'num aj-readonly-qty'}>{qty}</span>
        ) : (
          <Stepper
            className="stepper--sm"
            value={qty}
            min={min}
            max={max}
            label={t('summary.adjust.qty', { name })}
            describedBy={describedBy}
            invalid={!!error}
            onChange={onQty}
          />
        )}
        <small className="aj-max">{t('summary.adjust.max', { max })}</small>
        {removed ? (
          <button type="button" className="btn btn--sm" aria-label={t('summary.adjust.restoreLabel', { name })} onClick={onRestore}>
            {t('summary.adjust.restore')}
          </button>
        ) : (
          onRemove && (
            <button type="button" className="aj-x" aria-label={t('summary.adjust.remove', { name })} onClick={onRemove}>
              ✕
            </button>
          )
        )}
      </div>
      {notes.length > 0 && (
        <small id={`${id}-note`} className="aj-note">
          {notes.join(' · ')}
        </small>
      )}
      {error && (
        <p id={`${id}-err`} className="ff-error">
          {error}
        </p>
      )}
    </div>
  );
}

function DeliveryTag({ line }: { line: Pick<LineView, 'qty' | 'delivered_qty'> }) {
  const { t } = useTranslation();
  if (line.delivered_qty >= line.qty) return <span className="tag tag--ok">{t('summary.adjust.status.done', { n: line.delivered_qty })}</span>;
  if (line.delivered_qty > 0) {
    return <span className="tag tag--warn">{t('summary.adjust.status.partial', { done: line.delivered_qty, total: line.qty })}</span>;
  }
  return <span className="tag">{t('summary.adjust.status.waiting')}</span>;
}

// Dòng danh mục (đã lưu hoặc mới thêm): đã sửa → nền xanh nhạt + số cũ gạch ngang
export function LineRow({ unit, base, tags, line, ...qty }: QtyProps & {
  unit: string;
  base?: number;
  tags?: ReactNode;
  line?: LineView;
}) {
  const { t } = useTranslation();
  const changed = base !== undefined && !qty.removed && qty.qty !== base;
  return (
    <li className={cls('aj-line', changed && 'is-changed', qty.removed && 'is-removed')}>
      <div className="aj-line-main">
        <span className="aj-name">{qty.name}</span> {unit && <small className="aj-unit">· {unit}</small>} {tags}
        {changed && (
          <span className="aj-was-wrap">
            <span className="sr-only">{t('summary.adjust.was')}: </span>
            <del className="aj-was">{base}</del>
          </span>
        )}
        {qty.removed && <span className="tag tag--danger">{t('summary.adjust.willRemove')}</span>}
      </div>
      <QtyCell {...qty} />
      <div className="aj-status">{line && <DeliveryTag line={line} />}</div>
    </li>
  );
}

// Khối món ngoài danh mục: review áp dụng ngay (tách khỏi Lưu), số lượng vẫn sửa cùng Lưu
export function CustomBlock({ line, base, onReviewed, onStale, ...qty }: QtyProps & {
  line: LineView;
  base: number;
  onReviewed: (r: ReviewResult) => void;
  onStale: () => void;
}) {
  const { t } = useTranslation();
  const fmt = useRequestFormat();
  const unit = fmt.unit(line.item?.unit ?? line.custom_unit);
  const changed = !qty.removed && qty.qty !== base;
  // ReviewActions có key theo dòng: hộp review giữ trạng thái riêng, không lẫn sang dòng khác khi danh sách đổi
  return (
    <li className={cls('aj-custom', changed && 'is-changed', qty.removed && 'is-removed')}>
      <span className="aj-thumb">
        {line.image_file_id && <img src={fileUrl(line.image_file_id)} alt={t('summary.adjust.imageAlt', { name: qty.name })} />}
      </span>
      <div className="aj-custom-main">
        <div>
          <b className="aj-name">{qty.name}</b>{' '}
          <span className="tag tag--info">{t('summary.adjust.customTag', { qty: line.qty, unit })}</span>
          {changed && (
            <span className="aj-was-wrap">
              <span className="sr-only">{t('summary.adjust.was')}: </span>
              <del className="aj-was">{base}</del>
            </span>
          )}
        </div>
        {line.custom_note && <p className="aj-custom-note">{t('summary.adjust.customNote', { note: line.custom_note })}</p>}
        <ReviewActions key={line.id} line={{ ...line, custom_name: qty.name }} onDone={onReviewed} onStale={onStale} />
        <QtyCell {...qty} />
      </div>
    </li>
  );
}
