import { useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { apiErrorCode } from '@/lib/api-error';
import { useMe } from '@/lib/me';
import { Dialog, DialogClose, DialogTitle } from '@/ui/dialog';
import { FormField } from '@/ui/form-field';
import { Icon } from '@/ui/icon';
import { useToast } from '@/ui/toast-context';
import { isFieldError, unitErrorKey } from './unit-errors';
import { nextSortOrder } from '@/lib/local-order';
import { createUnit, useRefreshUnits, type AdminUnit } from './units.api';

const NAME_MAX = 40;

export function AddUnitDialog({ units, onClose }: { units: AdminUnit[]; onClose: () => void }) {
  const { t } = useTranslation();
  const { csrfToken } = useMe();
  const refresh = useRefreshUnits();
  const toast = useToast();
  const [name, setName] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [error, setError] = useState<{ field: 'name' | 'name_en' | 'form'; key: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const err = (f: string) => (error?.field === f ? t(error.key) : undefined);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const body = { name: name.trim(), name_en: nameEn.trim() || null, sort_order: nextSortOrder(units) };
    setSaving(true);
    try {
      await createUnit(body, csrfToken);
      toast.show({ text: t('units.page.added', { name: body.name }), tone: 'ok' });
      void refresh();
      onClose();
    } catch (cause) {
      const nameEnBad = apiErrorCode(cause) === 'VALIDATION' && !isFieldError(cause, 'name') && isFieldError(cause, 'name_en');
      const field = nameEnBad ? 'name_en' : isFieldError(cause, 'name') ? 'name' : 'form';
      setError({ field, key: unitErrorKey(cause) });
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} dirty={name !== '' || nameEn !== ''} dismissible={!saving} className="sheet a-form" maxWidth={520}>
      <form onSubmit={submit} noValidate>
        <div className="sheet-header">
          <DialogTitle className="sheet-title">{t('units.page.addTitle')}</DialogTitle>
          <DialogClose asChild>
            <button type="button" className="sheet-close" aria-label={t('common.close')} disabled={saving}>
              <Icon name="x" />
            </button>
          </DialogClose>
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
            {saving ? t('units.page.saving') : t('units.page.submitAdd')}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
