import { useTranslation } from 'react-i18next';
import { FormField } from '@/ui/form-field';
import { UnitSelect } from '@/features/units/unit-select';
import { Listbox } from '@/ui/listbox';
import type { FieldErrors } from './catalog-errors';
import type { CategoryIndex } from './catalog-rows';
import { categoryLabel } from './catalog.api';
import { ImageField } from './image-field';
import type { ItemDraft } from './item-draft';

const TEXT_MAX = 120;
const CODE_MAX = 40;

type OnChange = <K extends keyof ItemDraft>(key: K, value: ItemDraft[K]) => void;

export function ItemFields({
  draft,
  errors,
  index,
  keepCategoryId,
  onChange,
  onUploadingChange,
}: {
  draft: ItemDraft;
  errors: FieldErrors;
  index: CategoryIndex;
  keepCategoryId?: string | null;
  onChange: OnChange;
  onUploadingChange: (busy: boolean) => void;
}) {
  const { t, i18n } = useTranslation();
  const err = (k: keyof ItemDraft) => (errors[k] ? t(errors[k]) : undefined);
  const text = (key: 'code' | 'name' | 'name_en' | 'pack_note', label: string, opts: { max?: number; required?: boolean; hint?: string; placeholder?: string } = {}) => (
    <FormField label={label} required={opts.required} hint={opts.hint} error={err(key)}>
      {(p) => <input {...p} value={draft[key]} maxLength={opts.max ?? TEXT_MAX} placeholder={opts.placeholder} onChange={(e) => onChange(key, e.target.value)} />}
    </FormField>
  );
  const number = (key: 'max_qty', label: string, opts: { required?: boolean; hint?: string; min?: number; max?: number } = {}) => (
    <FormField label={label} required={opts.required} hint={opts.hint} error={err(key)}>
      {(p) => (
        <input {...p} type="number" inputMode="numeric" step={1} min={opts.min} max={opts.max} value={draft[key]} onChange={(e) => onChange(key, e.target.value)} />
      )}
    </FormField>
  );
  // Nhóm đã ngừng chỉ còn là lựa chọn nếu món đang thuộc nhóm đó
  const groups = index.ordered.filter((c) => c.active || c.id === keepCategoryId);
  const group = (
    <FormField label={t('catalog.form.category')} error={err('category_id')}>
      {(p) => (
        <Listbox
          {...p}
          value={draft.category_id}
          onChange={(v) => onChange('category_id', v)}
          options={[
            { value: '', label: t('catalog.page.noCategory') },
            ...groups.map((c) => ({
              value: c.id,
              label: c.active ? categoryLabel(c, i18n.language) : t('catalog.form.inactiveCategory', { name: categoryLabel(c, i18n.language) }),
            })),
          ]}
        />
      )}
    </FormField>
  );
  return (
    <>
      <section className="ct-panel-sec">
        <h3 className="ct-panel-sec__title">{t('catalog.panel.info')}</h3>
        <ImageField
          fileId={draft.image_file_id}
          error={err('image_file_id')}
          required
          tone={index.tone.get(draft.category_id) ?? 'g0'}
          onChange={(id) => onChange('image_file_id', id)}
          onBusyChange={onUploadingChange}
        />
        {text('name', t('catalog.form.name'), { required: true })}
        {text('name_en', t('catalog.form.nameEn'))}
        <div className="ct-panel-row">
          {group}
          <FormField label={t('catalog.form.unit')} required error={err('unit')}>
            {(p) => <UnitSelect {...p} value={draft.unit} onValueChange={(v) => onChange('unit', v)} />}
          </FormField>
        </div>
        <div className="ct-panel-row">
          {text('code', t('catalog.form.code'), { max: CODE_MAX })}
          {text('pack_note', t('catalog.form.packNote'), { placeholder: t('catalog.form.packNoteHint') })}
        </div>
      </section>
      <section className="ct-panel-sec">
        <h3 className="ct-panel-sec__title">{t('catalog.panel.ordering')}</h3>
        <div className="ct-panel-row ct-panel-row--end">
          {number('max_qty', t('catalog.form.maxQty'), { required: true, min: 1, max: 999 })}
        </div>
      </section>
    </>
  );
}
