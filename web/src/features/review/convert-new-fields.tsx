import { useId, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { FormField } from '@/ui/form-field';
import { categoryLabel, type Category } from '@/features/catalog/catalog.api';
import type { FieldErrors } from '@/features/catalog/catalog-errors';
import { indexCategories } from '@/features/catalog/catalog-rows';
import type { ItemDraft } from '@/features/catalog/item-draft';
import { ImageField } from '@/features/catalog/image-field';
import { UnitSelect } from '@/features/units/unit-select';

export function ConvertNewFields({ draft, errors, categories, onChange, onUploadingChange }: {
  draft: ItemDraft;
  errors: FieldErrors;
  categories: Category[];
  onChange: <K extends keyof ItemDraft>(key: K, value: ItemDraft[K]) => void;
  onUploadingChange: (busy: boolean) => void;
}) {
  const { t, i18n } = useTranslation();
  const uid = useId();
  const err = (k: string) => (errors[k] ? t(errors[k]) : undefined);
  const active = categories.filter((c) => c.active);
  const tones = useMemo(() => indexCategories(categories).tone, [categories]);
  return (
    <>
      <div className="a-form-wide">
        <ImageField
          fileId={draft.image_file_id}
          error={err('image_file_id')}
          required
          onChange={(id) => onChange('image_file_id', id)}
          onBusyChange={onUploadingChange}
        />
      </div>
      <FormField label={t('catalog.form.itemName')} required error={err('name')}>
        {(p) => <input {...p} value={draft.name} onChange={(e) => onChange('name', e.target.value)} />}
      </FormField>
      <FormField label={t('catalog.form.nameEn')} error={err('name_en')}>
        {(p) => <input {...p} value={draft.name_en} onChange={(e) => onChange('name_en', e.target.value)} />}
      </FormField>
      <FormField label={t('catalog.form.unit')} required error={err('unit')}>
        {(p) => <UnitSelect {...p} value={draft.unit} onValueChange={(v) => onChange('unit', v)} />}
      </FormField>
      <FormField label={t('catalog.form.maxQty')} required error={err('max_qty')}>
        {(p) => (
          <input {...p} type="number" inputMode="numeric" step={1} value={draft.max_qty} onChange={(e) => onChange('max_qty', e.target.value)} />
        )}
      </FormField>
      <div className={`ff a-form-wide${errors.category_id ? ' ff--error' : ''}`}>
        <span className="ff-label">
          {t('catalog.form.category')}
          <span className="ff-req" aria-hidden="true"> *</span>
        </span>
        <div
          role="radiogroup"
          aria-label={t('catalog.form.category')}
          aria-required="true"
          aria-invalid={errors.category_id ? true : undefined}
          aria-describedby={errors.category_id ? `${uid}-cat` : undefined}
          className="rv-chips"
        >
          {active.map((c) => {
            const tone = tones.get(c.id) ?? 'g0';
            return (
              <button
                key={c.id}
                type="button"
                role="radio"
                aria-checked={draft.category_id === c.id}
                className="rv-chip"
                onClick={() => onChange('category_id', c.id)}
              >
                <span className="rv-dot" data-tone={tone} style={{ background: `var(--${tone}-ink)` }} aria-hidden="true" />
                {categoryLabel(c, i18n.language)}
              </button>
            );
          })}
        </div>
        {errors.category_id && (
          <p id={`${uid}-cat`} className="ff-error">
            {err('category_id')}
          </p>
        )}
      </div>
    </>
  );
}
