import { useTranslation } from 'react-i18next';
import { FormField } from '@/ui/form-field';
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
        <select {...c} className="a-input" value={value} autoFocus onChange={(e) => onChange(e.target.value)}>
          <option value="" disabled>
            {t('stock.dialog.pickPlaceholder')}
          </option>
          {choices.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      )}
    </FormField>
  );
}
