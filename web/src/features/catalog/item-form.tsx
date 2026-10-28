import { useId, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useMe } from '@/lib/me';
import { Dialog, DialogClose, DialogTitle } from '@/ui/dialog';
import { FormField } from '@/ui/form-field';
import {
  categoryLabel,
  createItem,
  patchItem,
  useRefreshCatalog,
  type AdminItem,
  type Category,
} from '@/features/catalog/catalog.api';
import { fieldErrors, type FieldErrors } from '@/features/catalog/catalog-errors';
import { ITEM_ERROR_FIELD, ITEM_FIELDS, draftFrom, itemPayload, type ItemDraft } from '@/features/catalog/item-draft';
import { ImageField } from '@/features/catalog/image-field';
import { UnitSelect } from '@/features/units/unit-select';

export function ItemForm({
  item,
  categories,
  onClose,
}: {
  item: AdminItem | null;
  categories: Category[];
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation();
  const me = useMe();
  const refresh = useRefreshCatalog();
  const uid = useId();
  const initial = useMemo(() => draftFrom(item, me.config.default_max_qty), [item, me.config.default_max_qty]);
  const [draft, setDraft] = useState(initial);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);
  const hasImage = draft.image_file_id !== null;
  const err = (k: string) => (errors[k] ? t(errors[k]) : undefined);

  const set = <K extends keyof ItemDraft>(key: K, value: ItemDraft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined, form: undefined }));
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const payload = itemPayload(draft, item);
    if (item && Object.keys(payload).length === 0) return onClose();
    setSaving(true);
    try {
      await (item ? patchItem(item.id, payload, me.csrfToken) : createItem(payload, me.csrfToken));
      void refresh();
      onClose();
    } catch (error) {
      setErrors(fieldErrors(error, ITEM_ERROR_FIELD, ITEM_FIELDS));
      setSaving(false);
    }
  };

  // Nhóm đã ngừng chỉ còn trong danh sách nếu món đang thuộc nhóm đó
  const categoryOptions = categories.filter((c) => c.active || c.id === item?.category_id);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} dirty={dirty} dismissible={!saving} className="sheet a-form" maxWidth={600}>
      <form onSubmit={submit} noValidate>
        <div className="sheet-header">
          <DialogTitle className="sheet-title">{t(item ? 'catalog.form.editTitle' : 'catalog.form.addTitle')}</DialogTitle>
          <DialogClose asChild>
            <button type="button" className="sheet-close" aria-label={t('common.close')} disabled={saving}>
              ✕
            </button>
          </DialogClose>
        </div>
        <div className="sheet-body a-form-grid">
          {errors.form && (
            <p role="alert" className="alert alert--danger a-form-wide">
              {t(errors.form)}
            </p>
          )}
          <div className="a-form-wide">
            <ImageField
              fileId={draft.image_file_id}
              error={err('image_file_id')}
              onChange={(id) => set('image_file_id', id)}
              onBusyChange={setUploading}
            />
          </div>
          <FormField label={t('catalog.form.name')} error={err('name')}>
            {(p) => <input {...p} value={draft.name} onChange={(e) => set('name', e.target.value)} />}
          </FormField>
          <FormField label={t('catalog.form.nameEn')} error={err('name_en')}>
            {(p) => <input {...p} value={draft.name_en} onChange={(e) => set('name_en', e.target.value)} />}
          </FormField>
          <FormField label={t('catalog.form.unit')} error={err('unit')}>
            {(p) => <UnitSelect {...p} value={draft.unit} onValueChange={(v) => set('unit', v)} />}
          </FormField>
          <FormField label={t('catalog.form.packNote')} error={err('pack_note')}>
            {(p) => (
              <input
                {...p}
                value={draft.pack_note}
                placeholder={t('catalog.form.packNoteHint')}
                onChange={(e) => set('pack_note', e.target.value)}
              />
            )}
          </FormField>
          <FormField label={t('catalog.form.category')} error={err('category_id')} className="a-form-wide">
            {(p) => (
              <select {...p} value={draft.category_id} onChange={(e) => set('category_id', e.target.value)}>
                <option value="">{t('catalog.form.noCategory')}</option>
                {categoryOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.active ? categoryLabel(c, i18n.language) : t('catalog.form.inactiveCategory', { name: categoryLabel(c, i18n.language) })}
                  </option>
                ))}
              </select>
            )}
          </FormField>
          <NumberField label={t('catalog.form.maxQty')} value={draft.max_qty} error={err('max_qty')} onChange={(v) => set('max_qty', v)} />
          <NumberField
            label={t('catalog.form.sortOrder')}
            hint={t('catalog.form.sortOrderHint')}
            value={draft.sort_order}
            error={err('sort_order')}
            onChange={(v) => set('sort_order', v)}
          />
          <div className="a-check a-form-wide">
            <label>
              <input
                type="checkbox"
                checked={draft.admin_only}
                aria-describedby={`${uid}-admin-only`}
                onChange={(e) => set('admin_only', e.target.checked)}
              />
              {t('catalog.form.adminOnly')}
            </label>
            <small id={`${uid}-admin-only`}>{t('catalog.form.adminOnlyHint')}</small>
          </div>
        </div>
        <div className="sheet-footer">
          {!hasImage && (
            <span id={`${uid}-need-image`} className="a-form-need">
              {t('catalog.form.imageNeeded')}
            </span>
          )}
          <DialogClose asChild>
            <button type="button" className="btn" disabled={saving}>
              {t('common.cancel')}
            </button>
          </DialogClose>
          <button
            type="submit"
            className="btn btn--primary"
            disabled={!hasImage || uploading || saving}
            aria-describedby={hasImage ? undefined : `${uid}-need-image`}
          >
            {saving ? t('catalog.form.saving') : t(item ? 'catalog.form.submitEdit' : 'catalog.form.submitAdd')}
          </button>
        </div>
      </form>
    </Dialog>
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
