import { useId, useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { toneAtRank } from '@/lib/group-tone';
import { useMe } from '@/lib/me';
import { DialogClose } from '@/ui/dialog';
import { OverlayPanel } from '@/ui/overlay-panel';
import { FormField } from '@/ui/form-field';
import { useToast } from '@/ui/toast-context';
import { createCategory, patchCategory, useRefreshCatalog, type Category, type CategoryPayload } from './catalog.api';
import { fieldErrors, type FieldErrors } from './catalog-errors';

const NAME_MAX = 120;
const ERROR_FIELD: Record<string, string> = { CATEGORY_EXISTS: 'name' };

function changedFields(category: Category, body: { name: string; name_en: string | null }): CategoryPayload {
  const out: CategoryPayload = {};
  if (body.name !== category.name) out.name = body.name;
  if (body.name_en !== category.name_en) out.name_en = body.name_en;
  return out;
}

// Server đặt nhóm mới sau nhóm cuối (max + 10), nên nó nhận màu của vị trí kế tiếp
function NewPosition({ categories }: { categories: Category[] }) {
  const { t } = useTranslation();
  const tone = toneAtRank(categories.length);
  return (
    <p className="cg-new-tone">
      <span className="ct-dot" style={{ background: `var(--${tone}-ink)` }} aria-hidden="true" />
      {t('catalog.categories.newPosition', { k: categories.length + 1, tone: t(`catalog.tones.${tone}`) })}
    </p>
  );
}

export function CategoryDialog({ categories, category, onClose }: { categories: Category[]; category?: Category; onClose: () => void }) {
  const { t } = useTranslation();
  const { csrfToken } = useMe();
  const formId = useId();
  const refresh = useRefreshCatalog();
  const toast = useToast();
  const [name, setName] = useState(category?.name ?? '');
  const [nameEn, setNameEn] = useState(category?.name_en ?? '');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);
  const err = (k: string) => (errors[k] ? t(errors[k]) : undefined);
  const dirty = name !== (category?.name ?? '') || nameEn !== (category?.name_en ?? '');

  const save = async (body: { name: string; name_en: string | null }) => {
    if (!category) {
      await createCategory(body, csrfToken);
      return t('catalog.categories.added', { name: body.name });
    }
    const patch = changedFields(category, body);
    if (Object.keys(patch).length > 0) await patchCategory(category.id, patch, csrfToken);
    return t('catalog.categories.saved', { name: body.name });
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const text = await save({ name: name.trim(), name_en: nameEn.trim() || null });
      toast.show({ text, tone: 'ok' });
      void refresh();
      onClose();
    } catch (error) {
      setErrors(fieldErrors(error, ERROR_FIELD, ['name', 'name_en']));
      setSaving(false);
    }
  };

  const title = t(category ? 'catalog.categories.editTitle' : 'catalog.categories.addTitle');
  const footer = (
    <>
      <DialogClose asChild>
        <button type="button" className="btn btn--ghost" disabled={saving}>
          {t('common.cancel')}
        </button>
      </DialogClose>
      <button type="submit" form={formId} className="btn btn--primary" disabled={saving || name.trim() === ''}>
        {saving ? t('catalog.form.saving') : t(category ? 'catalog.categories.submitEdit' : 'catalog.categories.submitAdd')}
      </button>
    </>
  );
  return (
    <OverlayPanel open wide onClose={onClose} title={title} dirty={dirty} saving={saving} footer={footer}>
      <form id={formId} className="ct-panel-form" onSubmit={submit} noValidate>
        {errors.form && (
          <p role="alert" className="alert alert--danger">
            {t(errors.form)}
          </p>
        )}
        <section className="ct-panel-sec">
          <h3 className="ct-panel-sec__title">{t('catalog.panel.info')}</h3>
          <FormField label={t('catalog.categories.name')} required error={err('name')}>
            {(p) => <input {...p} value={name} maxLength={NAME_MAX} onChange={(e) => setName(e.target.value)} />}
          </FormField>
          <FormField label={t('catalog.categories.nameEn')} error={err('name_en')}>
            {(p) => <input {...p} value={nameEn} maxLength={NAME_MAX} onChange={(e) => setNameEn(e.target.value)} />}
          </FormField>
          {!category && <NewPosition categories={categories} />}
        </section>
      </form>
    </OverlayPanel>
  );
}
