import { useLayoutEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/ui/icon';

export function ReorderToggle({ count, onStart }: { count: number; onStart: () => void }) {
  const { t } = useTranslation();
  const tooFew = count < 2;
  return (
    <button type="button" className="btn" disabled={tooFew} title={tooFew ? t('common.reorder.needTwo') : undefined} onClick={onStart}>
      <Icon name="sort" size={18} />
      {t('common.reorder.start')}
    </button>
  );
}

export function ReorderHead() {
  const { t } = useTranslation();
  return (
    <th className="reorder-col">
      <span className="sr-only">{t('common.reorder.column')}</span>
    </th>
  );
}

interface CellProps {
  index: number;
  count: number;
  name: string;
  disabled?: boolean;
  onMove: (index: number, dir: -1 | 1) => void;
}

export function ReorderCell({ index, count, name, disabled, onMove }: CellProps) {
  const { t } = useTranslation();
  const upRef = useRef<HTMLButtonElement>(null);
  const downRef = useRef<HTMLButtonElement>(null);
  const pressed = useRef<{ from: number; dir: -1 | 1 } | null>(null);
  // <tr> bị dời theo key làm trình duyệt bỏ tiêu điểm; mũi tên vừa bấm tắt ở biên thì sang mũi tên kia
  useLayoutEffect(() => {
    const p = pressed.current;
    if (!p || p.from === index) return;
    pressed.current = null;
    const [same, other] = p.dir === -1 ? [upRef, downRef] : [downRef, upRef];
    (same.current && !same.current.disabled ? same.current : other.current)?.focus();
  }, [index]);
  const move = (dir: -1 | 1) => {
    pressed.current = { from: index, dir };
    onMove(index, dir);
  };
  const upOff = disabled || index === 0;
  const downOff = disabled || index === count - 1;
  return (
    <td className="reorder-col">
      <span className="reorder-ctl">
        <span className="reorder-ctl__grip" aria-hidden="true" title={t('common.reorder.handle')}>
          ⋮⋮
        </span>
        <span className="reorder-ctl__arrows">
          <button ref={upRef} type="button" className="reorder-ctl__btn" aria-label={t('common.reorder.moveUp', { name })} disabled={upOff} onClick={() => move(-1)}>
            <Icon name="chevup" size={16} />
          </button>
          <button ref={downRef} type="button" className="reorder-ctl__btn" aria-label={t('common.reorder.moveDown', { name })} disabled={downOff} onClick={() => move(1)}>
            <Icon name="chev" size={16} />
          </button>
        </span>
      </span>
    </td>
  );
}

interface BarProps {
  dirty: boolean;
  dirtyText: string;
  saving: boolean;
  onCancel: () => void;
  onSave: () => void;
}

export function ReorderBar({ dirty, dirtyText, saving, onCancel, onSave }: BarProps) {
  const { t } = useTranslation();
  return (
    <div className="reorder-bar" role="group" aria-label={t('common.reorder.bar')}>
      <span className="reorder-bar__text" aria-live="polite">
        {dirty ? dirtyText : t('common.reorder.hint')}
      </span>
      <button type="button" className="btn btn--ghost" disabled={saving} onClick={onCancel}>
        {t('common.reorder.cancel')}
      </button>
      <button
        type="button"
        className="btn btn--primary"
        disabled={saving || !dirty}
        aria-busy={saving}
        title={!dirty && !saving ? t('common.reorder.noChange') : undefined}
        onClick={onSave}
      >
        {saving ? t('common.reorder.saving') : t('common.reorder.save')}
      </button>
    </div>
  );
}
