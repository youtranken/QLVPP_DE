import { useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useMe } from '@/lib/me';
import { Dialog, DialogClose, DialogTitle } from '@/ui/dialog';
import { FormField } from '@/ui/form-field';
import { createCategory, patchCategory, useRefreshCatalog, type Category } from '@/features/catalog/catalog.api';
import { fieldErrors, type FieldErrors } from '@/features/catalog/catalog-errors';

const ERROR_FIELD: Record<string, string> = { CATEGORY_EXISTS: 'name' };

export function CategoryForm({
  category,
  nextSortOrder,
  onClose,
}: {
  category: Category | null;
  nextSortOrder: number;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { csrfToken } = useMe();
  const refresh = useRefreshCatalog();
  const [name, setName] = useState(category?.name ?? '');
  const [nameEn, setNameEn] = useState(category?.name_en ?? '');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);
  const dirty = name !== (category?.name ?? '') || nameEn !== (category?.name_en ?? '');
  const err = (k: string) => (errors[k] ? t(errors[k]) : undefined);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const body = { name: name.trim(), name_en: nameEn.trim() || null };
    setSaving(true);
    try {
      if (category) {
        const changed = Object.fromEntries(
          Object.entries(body).filter(([k, v]) => category[k as keyof Category] !== v),
        );
        if (Object.keys(changed).length > 0) await patchCategory(category.id, changed, csrfToken);
      } else {
        await createCategory({ ...body, sort_order: nextSortOrder }, csrfToken);
      }
      void refresh();
      onClose();
    } catch (error) {
      setErrors(fieldErrors(error, ERROR_FIELD, ['name', 'name_en']));
      setSaving(false);
    }
  };

  const title = t(category ? 'catalog.categories.editTitle' : 'catalog.categories.addTitle');
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} dirty={dirty} dismissible={!saving} maxWidth={460}>
      <form onSubmit={submit} noValidate>
        <div className="sheet-header">
          <DialogTitle className="sheet-title">{title}</DialogTitle>
          <DialogClose asChild>
            <button type="button" className="sheet-close" aria-label={t('common.close')} disabled={saving}>
              ✕
            </button>
          </DialogClose>
        </div>
        <div className="sheet-body">
          {errors.form && (
            <p role="alert" className="alert alert--danger">
              {t(errors.form)}
            </p>
          )}
          <FormField label={t('catalog.categories.name')} error={err('name')}>
            {(p) => <input {...p} value={name} onChange={(e) => setName(e.target.value)} />}
          </FormField>
          <FormField label={t('catalog.categories.nameEn')} error={err('name_en')}>
            {(p) => <input {...p} value={nameEn} onChange={(e) => setNameEn(e.target.value)} />}
          </FormField>
        </div>
        <div className="sheet-footer">
          <DialogClose asChild>
            <button type="button" className="btn" disabled={saving}>
              {t('common.cancel')}
            </button>
          </DialogClose>
          <button type="submit" className="btn btn--primary" disabled={saving || name.trim() === ''}>
            {t(category ? 'catalog.categories.submitEdit' : 'catalog.categories.submitAdd')}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
