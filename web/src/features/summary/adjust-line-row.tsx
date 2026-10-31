import { useId } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/ui/icon';
import { Stepper } from '@/ui/stepper';

export interface LineRowProps {
  name: string;
  meta: string;
  thumb: ReactNode;
  qty: number;
  min: number;
  max: number;
  base?: number;
  tags?: ReactNode;
  error?: string;
  removed?: boolean;
  readOnly?: boolean;
  onQty: (n: number) => void;
  onRemove?: () => void;
  onRestore?: () => void;
  children?: ReactNode;
}

const cls = (...names: (string | false | undefined)[]) => names.filter(Boolean).join(' ');

function QtyControl({ name, qty, min, max, error, removed, readOnly, errorId, onQty, onRemove, onRestore }: LineRowProps & { errorId: string }) {
  const { t } = useTranslation();
  if (removed) {
    return (
      <button type="button" className="btn btn--sm" aria-label={t('summary.adjust.restoreLabel', { name })} onClick={onRestore}>
        {t('summary.adjust.restore')}
      </button>
    );
  }
  return (
    <>
      {readOnly ? (
        <span className="num aj-line__fixed">{qty}</span>
      ) : (
        <Stepper value={qty} min={min} max={max} label={name} describedBy={error ? errorId : undefined} invalid={!!error} onChange={onQty} />
      )}
      {onRemove && (
        <button type="button" className="aj-line__drop" aria-label={t('summary.adjust.remove', { name })} onClick={onRemove}>
          <Icon name="x" size={18} />
        </button>
      )}
    </>
  );
}

// Dòng đã sửa: badge "Trước khi sửa"; dòng sẽ bỏ: badge đỏ + "Giữ lại" thay chỗ stepper
export function LineRow(props: LineRowProps) {
  const { t } = useTranslation();
  const errorId = useId();
  const { name, meta, thumb, qty, base, tags, error, removed, children } = props;
  const changed = base !== undefined && !removed && qty !== base;
  return (
    <li className={cls('aj-line', changed && 'is-changed', removed && 'is-removed', error && 'has-error')}>
      {thumb}
      <div className="aj-line__main">
        <span className="aj-line__name">{name}</span>
        <small className="aj-line__meta">{meta}</small>
        <span className="aj-line__tags">
          {tags}
          {changed && <span className="tag tag--warn">{t('summary.adjust.was', { n: base })}</span>}
          {removed && <span className="tag tag--danger">{t('summary.adjust.willRemove')}</span>}
        </span>
        {error && (
          <p id={errorId} className="aj-line__error">
            {error}
          </p>
        )}
      </div>
      <div className="aj-line__qty">
        <QtyControl {...props} errorId={errorId} />
      </div>
      {children && <div className="aj-line__extra">{children}</div>}
    </li>
  );
}
