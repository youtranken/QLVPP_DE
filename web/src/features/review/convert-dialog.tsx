import { useId, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useUnitNames } from '@/features/units/units.api';
import { apiErrorCode } from '@/lib/api-error';
import { useMe } from '@/lib/me';
import { Dialog, DialogClose, DialogTitle } from '@/ui/dialog';
import { useAdminItems, useAllCategories } from '@/features/catalog/catalog.api';
import { fieldErrors, type FieldErrors } from '@/features/catalog/catalog-errors';
import { ITEM_ERROR_FIELD, ITEM_FIELDS, draftFrom, itemPayload, type ItemDraft } from '@/features/catalog/item-draft';
import { ConvertExisting } from './convert-existing';
import { ConvertNewFields } from './convert-new-fields';
import type { ReviewBody, ReviewableLine } from './review.api';
import { reviewErrorKey } from './review-errors';
import '@/features/catalog/catalog.css';

type Mode = 'new' | 'existing';
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

function serverErrors(e: unknown, mode: Mode): FieldErrors {
  const code = apiErrorCode(e);
  if (code === 'ITEM_NOT_FOUND' || code === 'ITEM_INACTIVE') return { [mode === 'existing' ? 'existing' : 'form']: reviewErrorKey(e) };
  if (mode === 'new') return fieldErrors(e, ITEM_ERROR_FIELD, ITEM_FIELDS, 'item.');
  return { form: reviewErrorKey(e) ?? 'review.errors.UNKNOWN' };
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

export function ConvertDialog({ line, who, onSubmit, onClose }: {
  line: ReviewableLine;
  who?: string;
  onSubmit: (item: ConvertItem) => Promise<void>;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation();
  const unitName = useUnitNames();
  const me = useMe();
  const uid = useId();
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
  const [pickedMode, setMode] = useState<Mode | null>(null);
  const [draft, setDraft] = useState(initial);
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const active = useMemo(
    () => (items.data ?? []).filter((i) => i.active).sort((a, b) => a.name.localeCompare(b.name, i18n.language)),
    [items.data, i18n.language],
  );
  // Đoán món có sẵn cùng tên → mặc định gắn vào món đó; admin vẫn tự chọn lại được
  const guessed = active.find((i) => normalized(i.name) === normalized(line.custom_name))?.id;
  const mode: Mode = pickedMode ?? (guessed ? 'existing' : 'new');
  const existingId = pickedId ?? guessed ?? '';
  const chosen = active.find((i) => i.id === existingId);
  const targetUnit = mode === 'new' ? draft.unit : chosen?.unit;
  const unitMismatch = !!targetUnit && !!line.custom_unit && targetUnit !== line.custom_unit;
  const dirty = pickedMode !== null || pickedId !== null || JSON.stringify(draft) !== JSON.stringify(initial);
  const canSubmit = !saving && !uploading && (mode !== 'existing' || !!chosen);

  const set = <K extends keyof ItemDraft>(key: K, value: ItemDraft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined, form: undefined }));
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    const missing = mode === 'new' ? localErrors(draft) : {};
    if (Object.keys(missing).length > 0) return setErrors(missing);
    setSaving(true);
    try {
      await onSubmit(mode === 'existing' ? { existing_id: existingId } : newItemOf(draft, line.image_file_id));
    } catch (err) {
      const code = apiErrorCode(err);
      // Món vừa bị ngừng/xóa ở nơi khác: tải lại để ô chọn bỏ món đó đi
      if (mode === 'existing' && (code === 'ITEM_INACTIVE' || code === 'ITEM_NOT_FOUND')) void items.refetch();
      setErrors(serverErrors(err, mode));
      setSaving(false);
    }
  };

  const err = (k: string) => (errors[k] ? t(errors[k]) : undefined);
  const name = line.custom_name ?? '';

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} dirty={dirty} dismissible={!saving} className="sheet a-form" maxWidth={520}>
      <form onSubmit={submit} noValidate>
        <div className="sheet-header">
          <DialogTitle className="sheet-title">{t('review.convert.title', { name })}</DialogTitle>
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
          <fieldset className="rv-mode a-form-wide">
            <legend className="ff-label">{t('review.convert.mode')}</legend>
            {(['new', 'existing'] as const).map((m) => (
              <label key={m} className="a-check-inline">
                <input
                  type="radio"
                  name={`${uid}-mode`}
                  checked={mode === m}
                  onChange={() => {
                    setMode(m);
                    setErrors({});
                  }}
                />
                {t(m === 'new' ? 'review.convert.modeNew' : 'review.convert.modeExisting')}
              </label>
            ))}
          </fieldset>
          {unitMismatch && (
            <p role="status" className="alert alert--warn a-form-wide">
              {mode === 'existing' && chosen
                ? t('review.convert.unitMismatchExisting', {
                    from: unitName(line.custom_unit),
                    item: chosen.name,
                    to: unitName(chosen.unit),
                    qty: line.qty,
                    who: who ?? t('review.convert.whoFallback'),
                  })
                : t('review.convert.unitMismatch', { unit: unitName(line.custom_unit), qty: line.qty })}
            </p>
          )}
          {mode === 'new' && line.image_file_id && draft.image_file_id === line.image_file_id && !errors.image_file_id && (
            <p className="ff-hint a-form-wide">{t('review.convert.imageFromStaff')}</p>
          )}
          {mode === 'new' ? (
            <ConvertNewFields
              draft={draft}
              errors={errors}
              categories={categories.data ?? []}
              onChange={set}
              onUploadingChange={setUploading}
            />
          ) : (
            <ConvertExisting
              items={active}
              categories={categories.data ?? []}
              selectedId={existingId}
              error={err('existing')}
              onPick={(id) => {
                setPickedId(id);
                setErrors({});
              }}
            />
          )}
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
