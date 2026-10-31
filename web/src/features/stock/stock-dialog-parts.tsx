import type { FormEvent, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogClose, DialogTitle } from '@/ui/dialog';
import { FormField } from '@/ui/form-field';
import { Icon } from '@/ui/icon';
import { useUnitName } from '@/features/units/units.api';
import { REASON_MAX } from './stock-input';

export function StockDialogShell({ title, itemUnit, stockQty, after, dirty, saving, submitLabel, formError, onSubmit, onClose, children }: {
  title: string;
  itemUnit: string;
  stockQty: number;
  after: number | null;
  dirty: boolean;
  saving: boolean;
  submitLabel: string;
  formError?: string;
  onSubmit: () => void;
  onClose: () => void;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const unit = useUnitName(itemUnit);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit();
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} dirty={dirty} dismissible={!saving} className="sheet a-form" maxWidth={480}>
      <form onSubmit={submit} noValidate>
        <div className="sheet-header">
          <DialogTitle className="sheet-title">{title}</DialogTitle>
          <DialogClose asChild>
            <button type="button" className="sheet-close" aria-label={t('common.close')} disabled={saving}>
              <Icon name="x" />
            </button>
          </DialogClose>
        </div>
        <div className="sheet-body">
          <p className="sk-now">
            <span>{t('stock.dialog.current', { qty: stockQty, unit })}</span>
            {after !== null && <b>{t('stock.dialog.after', { qty: after })}</b>}
          </p>
          {formError && (
            <p role="alert" className="alert alert--danger">
              {formError}
            </p>
          )}
          {children}
        </div>
        <div className="sheet-footer">
          <DialogClose asChild>
            <button type="button" className="btn btn--ghost" disabled={saving}>
              {t('common.cancel')}
            </button>
          </DialogClose>
          <button type="submit" className="btn btn--primary" disabled={saving} aria-busy={saving}>
            {saving ? t('stock.dialog.saving') : submitLabel}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

export function QtyField({ label, hint, value, error, autoFocus, onChange }: {
  label: string;
  hint?: string;
  value: string;
  error?: string;
  autoFocus?: boolean;
  onChange: (v: string) => void;
}) {
  return (
    <FormField label={label} hint={hint} error={error} required>
      {(c) => <input {...c} className="a-input num" type="number" inputMode="numeric" step={1} autoFocus={autoFocus} value={value} onChange={(e) => onChange(e.target.value)} />}
    </FormField>
  );
}

export function TextField({ label, hint, value, error, required, onChange }: {
  label: string;
  hint?: string;
  value: string;
  error?: string;
  required?: boolean;
  onChange: (v: string) => void;
}) {
  return (
    <FormField label={label} hint={hint} error={error} required={required}>
      {(c) => <input {...c} className="a-input" maxLength={REASON_MAX} value={value} onChange={(e) => onChange(e.target.value)} />}
    </FormField>
  );
}
