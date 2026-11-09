import { useId, useState } from 'react';
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
  // Số cũ của dòng: sau khóa sổ chỉ giảm, gõ lớn hơn thì kẹp về số này
  base: number;
  tags?: ReactNode;
  error?: string;
  removed?: boolean;
  readOnly?: boolean;
  // Món tạm ngưng: tên gạch ngang + chữ đỏ "Tạm ngưng" thay dòng phụ; muted = không còn được tính (số cũng gạch)
  paused?: boolean;
  muted?: boolean;
  onQty: (n: number) => void;
  onRemove?: () => void;
  onRestore?: () => void;
  children?: ReactNode;
}

const cls = (...names: (string | false | undefined)[]) => names.filter(Boolean).join(' ');

function QtyControl({ name, qty, min, base, error, removed, readOnly, muted, errorId, onQty, onRemove, onRestore, onCapped }: LineRowProps & { errorId: string; onCapped: (v: boolean) => void }) {
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
        <span className={cls('num aj-line__fixed', muted && 'is-muted')}>{qty}</span>
      ) : (
        <Stepper
          value={qty}
          min={min}
          max={base}
          decreaseOnly
          className="aj-qty"
          label={name}
          describedBy={error ? errorId : undefined}
          invalid={!!error}
          onOverMax={() => onCapped(true)}
          onChange={(n) => {
            onCapped(false);
            onQty(n);
          }}
        />
      )}
      {onRemove && (
        <button type="button" className="aj-line__drop" aria-label={t('summary.adjust.remove', { name })} onClick={onRemove}>
          <Icon name="x" size={18} />
        </button>
      )}
    </>
  );
}

// Dòng đã sửa: badge "Trước khi sửa"; dòng sẽ bỏ: badge đỏ + "Giữ lại" thay chỗ ô số
export function LineRow(props: LineRowProps) {
  const { t } = useTranslation();
  const errorId = useId();
  // Gõ số lớn hơn số cũ: ô kẹp về số cũ, báo không tăng được tới lần đổi số kế tiếp
  const [capped, setCapped] = useState(false);
  const { name, meta, thumb, qty, base, tags, error, removed, paused, children } = props;
  const changed = !removed && qty !== base;
  return (
    <li className={cls('aj-line', changed && 'is-changed', removed && 'is-removed', error && 'has-error')}>
      {thumb}
      <div className="aj-line__main">
        <span className={cls('aj-line__name', paused && 'is-paused')}>{name}</span>
        {paused ? <small className="aj-line__paused">{t('common.paused')}</small> : <small className="aj-line__meta">{meta}</small>}
        <span className="aj-line__tags">
          {tags}
          {changed && <span className="tag tag--warn">{t('summary.adjust.was', { n: base })}</span>}
          {removed && <span className="tag tag--danger">{t('summary.adjust.willRemove')}</span>}
        </span>
        {capped && !removed && <p className="aj-line__hint">{t('summary.adjust.noIncrease')}</p>}
        {error && (
          <p id={errorId} className="aj-line__error">
            {error}
          </p>
        )}
      </div>
      <div className="aj-line__qty">
        <QtyControl {...props} errorId={errorId} onCapped={setCapped} />
      </div>
      {children && <div className="aj-line__extra">{children}</div>}
    </li>
  );
}
