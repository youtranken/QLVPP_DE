import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMe } from '@/lib/me';
import { useUnitName } from '@/features/units/units.api';
import { changeStock } from './stock.api';
import { QtyField, StockDialogShell, TextField } from './stock-dialog-parts';
import { toInt } from './stock-input';
import { useStockSubmit } from './use-stock-submit';
import type { StockRow } from './stock-rows';

export function PurchaseDialog({ item, onClose }: { item: StockRow; onClose: () => void }) {
  const { t } = useTranslation();
  const { csrfToken } = useMe();
  const unit = useUnitName(item.unit);
  const { errors, saving, run, fail, clear } = useStockSubmit(unit, onClose);
  const [qty, setQty] = useState('');
  const [note, setNote] = useState('');
  const delta = toInt(qty);
  const submit = () => {
    if (delta === null) return fail('qty', t('stock.errors.FIELD_INVALID'));
    void run(() => changeStock(item.id, { delta, reason: 'purchase', note: note.trim() || null }, csrfToken), t('stock.dialog.purchased', { qty: delta, unit, name: item.name }));
  };
  return (
    <StockDialogShell
      title={t('stock.dialog.purchaseTitle')}
      itemName={item.name}
      itemUnit={item.unit}
      stockQty={item.stock_qty}
      after={delta !== null && delta > 0 ? item.stock_qty + delta : null}
      dirty={qty !== '' || note !== ''}
      saving={saving}
      submitLabel={t('stock.dialog.submitPurchase')}
      formError={errors.form}
      onSubmit={submit}
      onClose={onClose}
    >
      <QtyField label={t('stock.dialog.purchaseQty')} value={qty} error={errors.qty} autoFocus onChange={(v) => { setQty(v); clear('qty'); }} />
      <TextField label={t('stock.dialog.note')} hint={t('stock.dialog.noteHint')} value={note} error={errors.reason} onChange={(v) => { setNote(v); clear('reason'); }} />
    </StockDialogShell>
  );
}
