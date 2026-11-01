import { useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { groupTone } from '@/lib/group-tone';
import { useMe } from '@/lib/me';
import { Dialog, DialogClose, DialogTitle } from '@/ui/dialog';
import { FormField } from '@/ui/form-field';
import { Icon } from '@/ui/icon';
import { useToast } from '@/ui/toast-context';
import { createCategory, useRefreshCatalog, type Category } from './catalog.api';
import { fieldErrors, type FieldErrors } from './catalog-errors';
import { nextSortOrder } from '@/lib/local-order';

const NAME_MAX = 120;
const ERROR_FIELD: Record<string, string> = { CATEGORY_EXISTS: 'name' };
const NEW_ID = 'new';

export function AddCategoryDialog({ categories, onClose }: { categories: Category[]; onClose: () => void }) {
  const { t } = useTranslation();
  const { csrfToken } = useMe();
  const refresh = useRefreshCatalog();
  const toast = useToast();
  const [name, setName] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);
  const sortOrder = nextSortOrder(categories);
  const tone = groupTone([...categories, { id: NEW_ID, name: '', sort_order: sortOrder }], NEW_ID);
  const err = (k: string) => (errors[k] ? t(errors[k]) : undefined);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const body = { name: name.trim(), name_en: nameEn.trim() || null, sort_order: sortOrder };
    setSaving(true);
    try {
      await createCategory(body, csrfToken);
      toast.show({ text: t('catalog.categories.added', { name: body.name }), tone: 'ok' });
      void refresh();
      onClose();
    } catch (error) {
      setErrors(fieldErrors(error, ERROR_FIELD, ['name', 'name_en']));
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} dirty={name !== '' || nameEn !== ''} dismissible={!saving} className="sheet a-form" maxWidth={520}>
      <form onSubmit={submit} noValidate>
        <div className="sheet-header">
          <DialogTitle className="sheet-title">{t('catalog.categories.addTitle')}</DialogTitle>
          <DialogClose asChild>
            <button type="button" className="sheet-close" aria-label={t('common.close')} disabled={saving}>
              <Icon name="x" />
            </button>
          </DialogClose>
        </div>
        <div className="sheet-body">
          {errors.form && (
            <p role="alert" className="alert alert--danger">
              {t(errors.form)}
            </p>
          )}
          <FormField label={t('catalog.categories.name')} required error={err('name')}>
            {(p) => <input {...p} value={name} maxLength={NAME_MAX} onChange={(e) => setName(e.target.value)} />}
          </FormField>
          <FormField label={t('catalog.categories.nameEn')} error={err('name_en')}>
            {(p) => <input {...p} value={nameEn} maxLength={NAME_MAX} onChange={(e) => setNameEn(e.target.value)} />}
          </FormField>
          <p className="cg-new-tone">
            <span className="ct-dot" style={{ background: `var(--${tone}-ink)` }} aria-hidden="true" />
            {t('catalog.categories.newPosition', { k: categories.length + 1, tone: t(`catalog.tones.${tone}`) })}
          </p>
        </div>
        <div className="sheet-footer">
          <DialogClose asChild>
            <button type="button" className="btn btn--ghost" disabled={saving}>
              {t('common.cancel')}
            </button>
          </DialogClose>
          <button type="submit" className="btn btn--primary" disabled={saving || name.trim() === ''}>
            {saving ? t('catalog.form.saving') : t('catalog.categories.submitAdd')}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
