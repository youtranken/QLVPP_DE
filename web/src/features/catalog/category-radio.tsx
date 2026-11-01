import { useId } from 'react';
import type { KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { categoryLabel, type Category } from './catalog.api';
import type { CategoryIndex } from './catalog-rows';

// Nhóm đã ngừng chỉ còn là lựa chọn nếu món đang thuộc nhóm đó
export function CategoryRadio({
  index,
  value,
  keepId,
  error,
  onChange,
}: {
  index: CategoryIndex;
  value: string;
  keepId?: string | null;
  error?: string;
  onChange: (id: string) => void;
}) {
  const { t, i18n } = useTranslation();
  const errorId = useId();
  const options = index.ordered.filter((c) => c.active || c.id === keepId);
  const focusIndex = Math.max(0, options.findIndex((c) => c.id === value));
  // Một điểm Tab cho cả nhóm, mũi tên đổi lựa chọn; preventDefault để ↑/↓ không chuyển món trong ngăn kéo
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (step === undefined || options.length === 0) return;
    e.preventDefault();
    const next = (focusIndex + step + options.length) % options.length;
    onChange(options[next].id);
    e.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]')[next]?.focus();
  };
  const label = (c: Category) => (c.active ? categoryLabel(c, i18n.language) : t('catalog.form.inactiveCategory', { name: categoryLabel(c, i18n.language) }));
  return (
    <div className={`ff${error ? ' ff--error' : ''}`}>
      <span className="ff-label">{t('catalog.form.category')}</span>
      <div
        role="radiogroup"
        className="ct-chips ct-chips--wrap"
        aria-label={t('catalog.form.category')}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        onKeyDown={onKeyDown}
      >
        {options.map((c, i) => (
          <button key={c.id} type="button" role="radio" className="ct-chip" title={label(c)} aria-checked={value === c.id} tabIndex={i === focusIndex ? 0 : -1} onClick={() => onChange(c.id)}>
            <span className="ct-dot" style={{ background: `var(--${index.tone.get(c.id) ?? 'g0'}-ink)` }} aria-hidden="true" />
            {label(c)}
          </button>
        ))}
      </div>
      {error && (
        <p id={errorId} className="ff-error">
          {error}
        </p>
      )}
    </div>
  );
}
