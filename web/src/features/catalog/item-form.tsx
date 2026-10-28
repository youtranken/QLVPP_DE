import { useId, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useMe } from '@/lib/me';
import { Dialog, DialogClose, DialogTitle } from '@/ui/dialog';
import {
  createItem,
  patchItem,
  useRefreshCatalog,
  type AdminItem,
  type Category,
} from '@/features/catalog/catalog.api';
import { fieldErrors, type FieldErrors } from '@/features/catalog/catalog-errors';
import { ITEM_ERROR_FIELD, ITEM_FIELDS, draftFrom, itemPayload, type ItemDraft } from '@/features/catalog/item-draft';
import { ItemFields } from '@/features/catalog/item-fields';

export function ItemForm({
  item,
  categories,
  onClose,
}: {
  item: AdminItem | null;
  categories: Category[];
  onClose: () => void;
}) {
  const { t } = useTranslation();
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
          <ItemFields
            draft={draft}
            errors={errors}
            categories={categories}
            keepCategoryId={item?.category_id}
            onChange={set}
            onUploadingChange={setUploading}
          />
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
