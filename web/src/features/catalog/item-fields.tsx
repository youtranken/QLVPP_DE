import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { FormField } from '@/ui/form-field';
import { Switch } from '@/ui/switch';
import { UnitSelect } from '@/features/units/unit-select';
import type { FieldErrors } from './catalog-errors';
import type { CategoryIndex } from './catalog-rows';
import { CategoryRadio } from './category-radio';
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
  const { t } = useTranslation();
  const hintId = useId();
  const err = (k: keyof ItemDraft) => (errors[k] ? t(errors[k]) : undefined);
  const text = (key: 'code' | 'name' | 'name_en' | 'pack_note', label: string, opts: { max?: number; required?: boolean; hint?: string; placeholder?: string } = {}) => (
    <FormField label={label} required={opts.required} hint={opts.hint} error={err(key)}>
      {(p) => <input {...p} value={draft[key]} maxLength={opts.max ?? TEXT_MAX} placeholder={opts.placeholder} onChange={(e) => onChange(key, e.target.value)} />}
    </FormField>
  );
  const number = (key: 'max_qty' | 'sort_order', label: string, opts: { required?: boolean; hint?: string; min?: number; max?: number } = {}) => (
    <FormField label={label} required={opts.required} hint={opts.hint} error={err(key)}>
      {(p) => (
        <input {...p} type="number" inputMode="numeric" step={1} min={opts.min} max={opts.max} value={draft[key]} onChange={(e) => onChange(key, e.target.value)} />
      )}
    </FormField>
  );
  return (
    <>
      <ImageField
        fileId={draft.image_file_id}
        error={err('image_file_id')}
        required
        tone={index.tone.get(draft.category_id) ?? 'g0'}
        onChange={(id) => onChange('image_file_id', id)}
        onBusyChange={onUploadingChange}
      />
      {text('code', t('catalog.form.code'), { max: CODE_MAX, hint: t('catalog.form.codeHint') })}
      {text('name', t('catalog.form.name'), { required: true })}
      {text('name_en', t('catalog.form.nameEn'))}
      <FormField label={t('catalog.form.unit')} required error={err('unit')}>
        {(p) => <UnitSelect {...p} value={draft.unit} onValueChange={(v) => onChange('unit', v)} />}
      </FormField>
      {text('pack_note', t('catalog.form.packNote'), { placeholder: t('catalog.form.packNoteHint') })}
      <CategoryRadio index={index} value={draft.category_id} keepId={keepCategoryId} error={err('category_id')} onChange={(id) => onChange('category_id', id)} />
      {number('max_qty', t('catalog.form.maxQty'), { required: true, min: 1, max: 999 })}
      {number('sort_order', t('catalog.form.sortOrder'), { hint: t('catalog.form.sortOrderHint') })}
      <div className="ct-switch-row">
        <Switch
          checked={draft.admin_only}
          label={t('catalog.form.adminOnly')}
          text={t('catalog.form.adminOnly')}
          describedBy={hintId}
          onChange={(v) => onChange('admin_only', v)}
        />
        <small id={hintId} className="ff-hint">
          {t('catalog.form.adminOnlyHint')}
        </small>
      </div>
    </>
  );
}
