import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMe } from '@/lib/me';
import { useUnitName } from '@/features/units/units.api';
import { userLabel, type DirectoryUser } from '@/features/directory/directory.api';
import { UserPicker } from '@/features/directory/user-picker';
import { issueStock } from './stock.api';
import { QtyField, StockDialogShell, TextField } from './stock-dialog-parts';
import { toInt } from './stock-input';
import { useStockSubmit } from './use-stock-submit';
import type { StockRow } from './stock-rows';

export function IssueDialog({ item, onClose }: { item: StockRow; onClose: () => void }) {
  const { t } = useTranslation();
  const { csrfToken } = useMe();
  const unit = useUnitName(item.unit);
  const { errors, saving, run, fail, clear } = useStockSubmit(unit, onClose);
  const [qty, setQty] = useState('');
  const [shared, setShared] = useState(false);
  const [recipient, setRecipient] = useState<DirectoryUser | null>(null);
  const [reason, setReason] = useState('');
  const n = toInt(qty);
  // Người nhận bị server từ chối: mở lại ô tìm để lỗi gắn đúng ô và chọn người khác
  useEffect(() => {
    if (errors.recipient) setRecipient(null);
  }, [errors.recipient]);
  const submit = () => {
    if (n === null) return fail('qty', t('stock.errors.FIELD_INVALID'));
    // Thiếu recipient_sub = "Dùng chung" ở server, nên không cho gửi khi chưa chọn gì
    if (!shared && !recipient) return fail('recipient', t('stock.errors.RECIPIENT_REQUIRED'));
    const who = shared || !recipient ? t('stock.dialog.sharedWho') : userLabel(recipient);
    const body = { qty: n, ...(shared || !recipient ? {} : { recipient_sub: recipient.sub }), reason: reason.trim() };
    void run(() => issueStock(item.id, body, csrfToken), t('stock.dialog.issued', { qty: n, unit, name: item.name, who }));
  };
  return (
    <StockDialogShell
      title={t('stock.dialog.issueTitle')}
      itemName={item.name}
      itemUnit={item.unit}
      stockQty={item.stock_qty}
      after={n !== null && n > 0 && n <= item.stock_qty ? item.stock_qty - n : null}
      dirty={qty !== '' || reason !== '' || shared || recipient !== null}
      saving={saving}
      submitLabel={t('stock.dialog.submitIssue')}
      formError={errors.form}
      onSubmit={submit}
      onClose={onClose}
    >
      <QtyField label={t('stock.dialog.issueQty')} value={qty} error={errors.qty} autoFocus onChange={(v) => { setQty(v); clear('qty'); }} />
      <div className="a-check">
        <label>
          <input type="checkbox" checked={shared} onChange={(e) => { setShared(e.target.checked); clear('recipient'); }} />
          {t('stock.dialog.shared')}
        </label>
        <small>{t('stock.dialog.sharedHint')}</small>
      </div>
      {!shared && (
        <UserPicker
          label={t('stock.picker.label')}
          searchLabel={t('stock.picker.search')}
          value={recipient}
          error={errors.recipient}
          hint={recipient ? undefined : t('stock.dialog.needRecipient')}
          required
          onChange={(u) => { setRecipient(u); clear('recipient'); }}
        />
      )}
      <TextField label={t('stock.dialog.reason')} hint={t('stock.dialog.issueReasonHint')} required value={reason} error={errors.reason} onChange={(v) => { setReason(v); clear('reason'); }} />
    </StockDialogShell>
  );
}
