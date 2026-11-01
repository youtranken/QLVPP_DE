import { useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { apiErrorCode } from '@/lib/api-error';
import { useMe } from '@/lib/me';
import { Dialog, DialogClose, DialogCloseButton, DialogTitle } from '@/ui/dialog';
import { FormField } from '@/ui/form-field';
import { useToast } from '@/ui/toast-context';
import { isFieldError, unitErrorKey } from './unit-errors';
import { nextSortOrder } from '@/lib/local-order';
import { createUnit, patchUnit, useRefreshUnits, type AdminUnit, type UnitPayload } from './units.api';

const NAME_MAX = 40;

function changedFields(unit: AdminUnit, body: { name: string; name_en: string | null }): UnitPayload {
  const out: UnitPayload = {};
  if (body.name !== unit.name) out.name = body.name;
  if (body.name_en !== unit.name_en) out.name_en = body.name_en;
  return out;
}

function errorField(cause: unknown): 'name' | 'name_en' | 'form' {
  if (apiErrorCode(cause) === 'VALIDATION' && !isFieldError(cause, 'name') && isFieldError(cause, 'name_en')) return 'name_en';
  return isFieldError(cause, 'name') ? 'name' : 'form';
}

export function UnitDialog({ units, unit, onClose }: { units: AdminUnit[]; unit?: AdminUnit; onClose: () => void }) {
  const { t } = useTranslation();
  const { csrfToken } = useMe();
  const refresh = useRefreshUnits();
  const toast = useToast();
  const [name, setName] = useState(unit?.name ?? '');
  const [nameEn, setNameEn] = useState(unit?.name_en ?? '');
  const [error, setError] = useState<{ field: 'name' | 'name_en' | 'form'; key: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const err = (f: string) => (error?.field === f ? t(error.key) : undefined);
  const dirty = name !== (unit?.name ?? '') || nameEn !== (unit?.name_en ?? '');

  const save = async (body: { name: string; name_en: string | null }) => {
    if (!unit) {
      await createUnit({ ...body, sort_order: nextSortOrder(units) }, csrfToken);
      return t('units.page.added', { name: body.name });
    }
    const patch = changedFields(unit, body);
    if (Object.keys(patch).length > 0) await patchUnit(unit.code, patch, csrfToken);
    return t('units.page.saved', { name: body.name });
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const text = await save({ name: name.trim(), name_en: nameEn.trim() || null });
      toast.show({ text, tone: 'ok' });
      void refresh();
      onClose();
    } catch (cause) {
      setError({ field: errorField(cause), key: unitErrorKey(cause) });
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} dirty={dirty} dismissible={!saving} className="sheet a-form" maxWidth={520}>
      <form onSubmit={submit} noValidate>
        <div className="sheet-header">
          <DialogTitle className="sheet-title">{t(unit ? 'units.page.editTitle' : 'units.page.addTitle')}</DialogTitle>
          <DialogCloseButton disabled={saving} />
        </div>
        <div className="sheet-body">
          {error?.field === 'form' && (
            <p role="alert" className="alert alert--danger">
              {t(error.key)}
            </p>
          )}
          <FormField label={t('units.page.name')} required error={err('name')}>
            {(p) => <input {...p} value={name} maxLength={NAME_MAX} onChange={(e) => setName(e.target.value)} />}
          </FormField>
          <FormField label={t('units.page.nameEn')} error={err('name_en')}>
            {(p) => <input {...p} value={nameEn} maxLength={NAME_MAX} onChange={(e) => setNameEn(e.target.value)} />}
          </FormField>
        </div>
        <div className="sheet-footer">
          <DialogClose asChild>
            <button type="button" className="btn btn--ghost" disabled={saving}>
              {t('common.cancel')}
            </button>
          </DialogClose>
          <button type="submit" className="btn btn--primary" disabled={saving || name.trim() === ''}>
            {saving ? t('units.page.saving') : t(unit ? 'units.page.submitEdit' : 'units.page.submitAdd')}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
