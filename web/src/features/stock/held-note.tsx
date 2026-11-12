import { useTranslation } from 'react-i18next';
import { FormField } from '@/ui/form-field';
import { Listbox } from '@/ui/listbox';
import type { StockRow } from './stock-rows';

export function IssueHeldNote({ waiting, qty, took, unit }: { waiting: number; qty: number; took: number; unit: string }) {
  const { t } = useTranslation();
  return (
    <div role="note" className="alert alert--warn sk-held-note">
      <span>{t('warn.W21', { k: waiting })}</span>
      <small>{t('warn.W21take', { q: qty, x: took, unit })}</small>
    </div>
  );
}

export function ItemPicker({ choices, value, onChange }: { choices: StockRow[]; value: string; onChange: (id: string) => void }) {
  const { t } = useTranslation();
  return (
    <FormField label={t('stock.dialog.pickItem')} required>
      {(c) => (
        <Listbox
          {...c}
          autoFocus
          value={value}
          placeholder={t('stock.dialog.pickPlaceholder')}
          options={choices.map((r) => ({ value: r.id, label: r.name }))}
          onChange={onChange}
        />
      )}
    </FormField>
  );
}
