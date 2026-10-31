import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { FormField } from '@/ui/form-field';
import { categoryLabel, type Category } from '@/features/catalog/catalog.api';
import type { FieldErrors } from '@/features/catalog/catalog-errors';
import type { ItemDraft } from '@/features/catalog/item-draft';
import { ImageField } from '@/features/catalog/image-field';
import { UnitSelect } from '@/features/units/unit-select';

// Trường món dùng chung cho form Danh mục và hộp "Thêm vào danh mục" của trang review
export function ItemFields({
  draft,
  errors,
  categories,
  keepCategoryId,
  imageRequired = false,
  withSortOrder = true,
  onChange,
  onUploadingChange,
}: {
  draft: ItemDraft;
  errors: FieldErrors;
  categories: Category[];
  keepCategoryId?: string | null;
  imageRequired?: boolean;
  withSortOrder?: boolean;
  onChange: <K extends keyof ItemDraft>(key: K, value: ItemDraft[K]) => void;
  onUploadingChange: (busy: boolean) => void;
}) {
  const { t, i18n } = useTranslation();
  const uid = useId();
  const err = (k: string) => (errors[k] ? t(errors[k]) : undefined);
  // Nhóm đã ngừng chỉ còn trong danh sách nếu món đang thuộc nhóm đó
  const categoryOptions = categories.filter((c) => c.active || c.id === keepCategoryId);
  return (
    <>
      <div className="a-form-wide">
        <ImageField
          fileId={draft.image_file_id}
          error={err('image_file_id')}
          required={imageRequired}
          onChange={(id) => onChange('image_file_id', id)}
          onBusyChange={onUploadingChange}
        />
      </div>
      <FormField label={t('catalog.form.name')} error={err('name')}>
        {(p) => <input {...p} value={draft.name} onChange={(e) => onChange('name', e.target.value)} />}
      </FormField>
      <FormField label={t('catalog.form.nameEn')} error={err('name_en')}>
        {(p) => <input {...p} value={draft.name_en} onChange={(e) => onChange('name_en', e.target.value)} />}
      </FormField>
      <FormField label={t('catalog.form.unit')} error={err('unit')}>
        {(p) => <UnitSelect {...p} value={draft.unit} onValueChange={(v) => onChange('unit', v)} />}
      </FormField>
      <FormField label={t('catalog.form.packNote')} error={err('pack_note')}>
        {(p) => (
          <input
            {...p}
            value={draft.pack_note}
            placeholder={t('catalog.form.packNoteHint')}
            onChange={(e) => onChange('pack_note', e.target.value)}
          />
        )}
      </FormField>
      <FormField label={t('catalog.form.category')} error={err('category_id')} className="a-form-wide">
        {(p) => (
          <select {...p} value={draft.category_id} onChange={(e) => onChange('category_id', e.target.value)}>
            <option value="">{t('catalog.form.noCategory')}</option>
            {categoryOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.active ? categoryLabel(c, i18n.language) : t('catalog.form.inactiveCategory', { name: categoryLabel(c, i18n.language) })}
              </option>
            ))}
          </select>
        )}
      </FormField>
      <NumberField label={t('catalog.form.maxQty')} value={draft.max_qty} error={err('max_qty')} onChange={(v) => onChange('max_qty', v)} />
      {withSortOrder && (
        <NumberField
          label={t('catalog.form.sortOrder')}
          hint={t('catalog.form.sortOrderHint')}
          value={draft.sort_order}
          error={err('sort_order')}
          onChange={(v) => onChange('sort_order', v)}
        />
      )}
      <div className="a-check a-form-wide">
        <label>
          <input
            type="checkbox"
            checked={draft.admin_only}
            aria-describedby={`${uid}-admin-only`}
            onChange={(e) => onChange('admin_only', e.target.checked)}
          />
          {t('catalog.form.adminOnly')}
        </label>
        <small id={`${uid}-admin-only`}>{t('catalog.form.adminOnlyHint')}</small>
      </div>
    </>
  );
}

function NumberField({
  label,
  hint,
  value,
  error,
  onChange,
}: {
  label: string;
  hint?: string;
  value: string;
  error?: string;
  onChange: (v: string) => void;
}) {
  return (
    <FormField label={label} hint={hint} error={error}>
      {(p) => <input {...p} type="number" inputMode="numeric" step={1} value={value} onChange={(e) => onChange(e.target.value)} />}
    </FormField>
  );
}
