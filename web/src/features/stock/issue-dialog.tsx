import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMe } from '@/lib/me';
import { useUnitName } from '@/features/units/units.api';
import { userLabel, type DirectoryUser } from '@/features/directory/directory.api';
import { UserPicker } from '@/features/directory/user-picker';
import { issueStock } from './stock.api';
import { IssueHeldNote, ItemPicker } from './held-note';
import { QtyField, StockDialogShell, TextField } from './stock-dialog-parts';
import { toInt } from './stock-input';
import { useStockSubmit } from './use-stock-submit';
import { tookHeldOf, type StockRow } from './stock-rows';

// item có sẵn khi mở từ một dòng; "Xuất lẻ một món" mở không có món và cho chọn trong choices
export function IssueDialog({ item, choices = [], onClose }: { item?: StockRow; choices?: StockRow[]; onClose: () => void }) {
  const { t } = useTranslation();
  const { csrfToken } = useMe();
  const [pickedId, setPickedId] = useState('');
  const current = item ?? choices.find((r) => r.id === pickedId);
  const unit = useUnitName(current?.unit ?? '');
  const { errors, saving, run, fail, clear } = useStockSubmit(unit, onClose);
  const [qty, setQty] = useState('');
  const [shared, setShared] = useState(false);
  const [recipient, setRecipient] = useState<DirectoryUser | null>(null);
  const [reason, setReason] = useState('');
  const n = toInt(qty);
  const took = current ? tookHeldOf(current, n) : 0;
  // Người nhận bị server từ chối: mở lại ô tìm để lỗi gắn đúng ô và chọn người khác
  useEffect(() => {
    if (errors.recipient) setRecipient(null);
  }, [errors.recipient]);
  const submit = () => {
    if (!current) return;
    if (n === null) return fail('qty', t('stock.errors.FIELD_INVALID'));
    if (n > current.stock_qty) return fail('qty', t('stock.errors.STOCK_INSUFFICIENT', { available: current.stock_qty, unit }));
    // Thiếu recipient_sub = "Dùng chung" ở server, nên không cho gửi khi chưa chọn gì
    if (!shared && !recipient) return fail('recipient', t('stock.errors.RECIPIENT_REQUIRED'));
    const who = shared || !recipient ? t('stock.dialog.sharedWho') : userLabel(recipient);
    const body = { qty: n, ...(shared || !recipient ? {} : { recipient_sub: recipient.sub }), reason: reason.trim() };
    void run(() => issueStock(current.id, body, csrfToken), t('stock.dialog.issued', { qty: n, unit, name: current.name, who }));
  };
  return (
    <StockDialogShell
      title={t('stock.dialog.issueTitle')}
      itemName={current?.name ?? ''}
      itemUnit={current?.unit ?? ''}
      stockQty={current?.stock_qty}
      after={current && n !== null && n > 0 && n <= current.stock_qty ? current.stock_qty - n : null}
      dirty={pickedId !== '' || qty !== '' || reason !== '' || shared || recipient !== null}
      saving={saving}
      submitLabel={took > 0 ? t('warn.W21ok') : t('stock.dialog.submitIssue')}
      submitDisabled={!current}
      formError={errors.form}
      onSubmit={submit}
      onClose={onClose}
    >
      {!item && <ItemPicker choices={choices} value={pickedId} onChange={setPickedId} />}
      <QtyField label={t('stock.dialog.issueQty')} value={qty} error={errors.qty} autoFocus={!!item} onChange={(v) => { setQty(v); clear('qty'); }} />
      {current && n !== null && took > 0 && <IssueHeldNote waiting={current.waiting} qty={n} took={took} unit={unit} />}
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
