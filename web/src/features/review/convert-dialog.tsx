import { useMemo, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useUnitNames } from '@/features/units/units.api';
import { apiErrorCode } from '@/lib/api-error';
import { useMe } from '@/lib/me';
import { Dialog, DialogClose, DialogCloseButton, DialogTitle } from '@/ui/dialog';
import { useAdminItems, useAllCategories } from '@/features/catalog/catalog.api';
import { fieldErrors, type FieldErrors } from '@/features/catalog/catalog-errors';
import { ITEM_ERROR_FIELD, ITEM_FIELDS, draftFrom, itemPayload, type ItemDraft } from '@/features/catalog/item-draft';
import { ConvertNewFields } from './convert-new-fields';
import type { ReviewBody, ReviewableLine } from './review.api';
import { reviewErrorKey } from './review-errors';

type ConvertItem = Extract<ReviewBody, { action: 'convert' }>['item'];

const normalized = (s: string | null) => (s ?? '').trim().toLowerCase();

function localErrors(d: ItemDraft): FieldErrors {
  const errors: FieldErrors = {};
  if (!d.name.trim()) errors.name = 'review.errors.NAME_REQUIRED';
  if (!d.image_file_id) errors.image_file_id = 'catalog.errors.IMAGE_REQUIRED';
  if (!d.unit) errors.unit = 'catalog.errors.UNIT_REQUIRED';
  if (!d.category_id) errors.category_id = 'review.errors.CATEGORY_REQUIRED';
  return errors;
}

function serverErrors(e: unknown): FieldErrors {
  const code = apiErrorCode(e);
  if (code === 'ITEM_NOT_FOUND' || code === 'ITEM_INACTIVE') return { form: reviewErrorKey(e) };
  return fieldErrors(e, ITEM_ERROR_FIELD, ITEM_FIELDS, 'item.');
}

// Món mới điền sẵn tên/ĐVT/ảnh của dòng; giữ ảnh dòng thì không gửi image_file_id để server dùng thẳng ảnh đó
function newItemOf(d: ItemDraft, lineImage: string | null): ConvertItem {
  const p = itemPayload(d, null);
  return {
    name: d.name.trim(),
    name_en: p.name_en ?? null,
    unit: d.unit,
    pack_note: p.pack_note ?? null,
    category_id: d.category_id,
    max_qty: p.max_qty as number,
    admin_only: d.admin_only,
    ...(d.image_file_id && d.image_file_id !== lineImage ? { image_file_id: d.image_file_id } : {}),
  };
}

export function ConvertDialog({ line, warning, onSubmit, onClose }: {
  line: ReviewableLine;
  warning?: ReactNode;
  onSubmit: (item: ConvertItem) => Promise<void>;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const unitName = useUnitNames();
  const me = useMe();
  const items = useAdminItems();
  const categories = useAllCategories();
  const initial = useMemo<ItemDraft>(
    () => ({
      ...draftFrom(null, me.config.default_max_qty),
      name: line.custom_name ?? '',
      unit: line.custom_unit ?? '',
      image_file_id: line.image_file_id,
    }),
    [line, me.config.default_max_qty],
  );
  const [draft, setDraft] = useState(initial);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Danh mục không chặn tên trùng: chỉ nhắc một dòng, không thêm bước bấm (kể cả món đã ngừng)
  const duplicate = useMemo(() => {
    const n = normalized(draft.name);
    return n ? (items.data ?? []).find((i) => normalized(i.name) === n) : undefined;
  }, [items.data, draft.name]);
  const unitMismatch = !!draft.unit && !!line.custom_unit && draft.unit !== line.custom_unit;
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);
  const canSubmit = !saving && !uploading;

  const set = <K extends keyof ItemDraft>(key: K, value: ItemDraft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined, form: undefined }));
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    const missing = localErrors(draft);
    if (Object.keys(missing).length > 0) return setErrors(missing);
    setSaving(true);
    try {
      await onSubmit(newItemOf(draft, line.image_file_id));
    } catch (err) {
      setErrors(serverErrors(err));
      setSaving(false);
    }
  };


  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} dirty={dirty} dismissible={!saving} className="sheet a-form" maxWidth={520}>
      <form onSubmit={submit} noValidate>
        <div className="sheet-header">
          <DialogTitle className="sheet-title">{t('review.convert.title')}</DialogTitle>
          <DialogCloseButton disabled={saving} />
        </div>
        <div className="sheet-body a-form-grid">
          {errors.form && (
            <p role="alert" className="alert alert--danger a-form-wide">
              {t(errors.form)}
            </p>
          )}
          {warning && (
            <div role="note" className="alert alert--warn a-form-wide">
              {warning}
            </div>
          )}
          {duplicate && (
            <p role="status" className="alert alert--warn a-form-wide">
              {t('review.convert.duplicate', { name: duplicate.name })}
            </p>
          )}
          {unitMismatch && (
            <p role="status" className="alert alert--warn a-form-wide">
              {t('review.convert.unitMismatch', { unit: unitName(line.custom_unit), qty: line.qty })}
            </p>
          )}
          {line.image_file_id && draft.image_file_id === line.image_file_id && !errors.image_file_id && (
            <p className="ff-hint a-form-wide">{t('review.convert.imageFromStaff')}</p>
          )}
          <ConvertNewFields
            draft={draft}
            errors={errors}
            categories={categories.data ?? []}
            onChange={set}
            onUploadingChange={setUploading}
          />
        </div>
        <div className="sheet-footer">
          <DialogClose asChild>
            <button type="button" className="btn btn--ghost" disabled={saving}>
              {t('review.back')}
            </button>
          </DialogClose>
          <button type="submit" className="btn btn--primary" disabled={!canSubmit}>
            {saving ? t('review.saving') : t('review.convert.submit')}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
