import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { apiErrorCode, apiErrorNumber } from '@/lib/api-error';
import { useMe } from '@/lib/me';
import { useUnitName } from '@/features/units/units.api';
import { countStock } from './stock.api';
import { CountHeldNote } from './held-note';
import { QtyField, StockDialogShell, TextField } from './stock-dialog-parts';
import { COUNT_MAX, signed, toInt } from './stock-input';
import { useStockSubmit } from './use-stock-submit';
import type { StockRow } from './stock-rows';

export function CountStockDialog({ item, onClose }: { item: StockRow; onClose: () => void }) {
  const { t } = useTranslation();
  const { csrfToken } = useMe();
  const unit = useUnitName(item.unit);
  const { errors, saving, run, fail, clear, refresh } = useStockSubmit(unit, onClose);
  const [stock, setStock] = useState(item.stock_qty);
  const [qty, setQty] = useState('');
  const [note, setNote] = useState('');
  const [staleSeen, setStaleSeen] = useState(false);
  const n = toInt(qty);
  const valid = n !== null && n >= 0 && n <= COUNT_MAX;
  const preview = valid && n !== stock ? t('stock.dialog.countPreview', { from: stock, to: n, delta: signed(n - stock) }) : null;
  // Tồn đổi ở nơi khác: báo số mới để người dùng đếm lại, không tự gửi lại
  const onStale = (e: unknown) => {
    const current = apiErrorCode(e) === 'STALE_UPDATE' ? apiErrorNumber(e, 'stock_qty') : undefined;
    if (current === undefined) return false;
    setStock(current);
    setStaleSeen(true);
    if (current !== n) fail('form', t('stock.errors.STALE_COUNT', { qty: current, unit }));
    void refresh();
    return true;
  };
  const submit = () => {
    if (!valid) return fail('qty', t('stock.errors.COUNT_RANGE'));
    const body = { counted_qty: n, expected_stock_qty: stock, note: note.trim() };
    void run(() => countStock(item.id, body, csrfToken), t('stock.dialog.counted', { name: item.name, from: stock, to: n }), onStale);
  };
  return (
    <StockDialogShell
      title={t('stock.dialog.countTitle')}
      itemName={item.name}
      itemUnit={item.unit}
      stockQty={stock}
      preview={preview}
      dirty={qty !== '' || note !== ''}
      saving={saving}
      submitLabel={t('stock.dialog.submitCount')}
      submitDisabled={qty.trim() === '' || n === stock}
      formError={errors.form}
      onSubmit={submit}
      onClose={onClose}
    >
      {staleSeen && valid && n === stock && (
        <p role="status" className="alert alert--ok">
          {t('stock.dialog.countMatches')}
        </p>
      )}
      <QtyField label={t('stock.dialog.countQty')} min={0} max={COUNT_MAX} value={qty} error={errors.qty} autoFocus onChange={(v) => { setQty(v); clear('qty'); }} />
      {valid && n !== null && <CountHeldNote counted={n} held={item.held} />}
      <TextField label={t('stock.dialog.reason')} hint={t('stock.dialog.countReasonHint')} required value={note} error={errors.reason} onChange={(v) => { setNote(v); clear('reason'); }} />
    </StockDialogShell>
  );
}
