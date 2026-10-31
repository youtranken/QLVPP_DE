import { useId } from 'react';
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
  const label = (c: Category) => (c.active ? categoryLabel(c, i18n.language) : t('catalog.form.inactiveCategory', { name: categoryLabel(c, i18n.language) }));
  return (
    <div className={`ff${error ? ' ff--error' : ''}`}>
      <span className="ff-label">{t('catalog.form.category')}</span>
      <div
        role="radiogroup"
        className="ct-chips"
        aria-label={t('catalog.form.category')}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
      >
        {options.map((c) => (
          <button key={c.id} type="button" role="radio" className="ct-chip" aria-checked={value === c.id} onClick={() => onChange(c.id)}>
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
