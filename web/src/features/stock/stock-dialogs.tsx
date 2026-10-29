import { useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useMe } from '@/lib/me';
import { useSingleFlight } from '@/lib/use-single-flight';
import { Dialog, DialogClose, DialogTitle } from '@/ui/dialog';
import { FormField } from '@/ui/form-field';
import type { AdminItem } from '@/features/catalog/catalog.api';
import { changeStock, issueStock, useRefreshStock } from '@/features/stock/stock.api';
import type { DirectoryUser } from '@/features/directory/directory.api';
import { stockErrors, type StockErrors } from '@/features/stock/stock-errors';
import { UserPicker } from '@/features/directory/user-picker';

const toInt = (text: string) => (text.trim() !== '' && Number.isInteger(Number(text)) ? Number(text) : null);

function useSubmit(onClose: () => void) {
  const { t } = useTranslation();
  const refresh = useRefreshStock();
  const [errors, setErrors] = useState<StockErrors>({});
  const flight = useSingleFlight();
  const run = (send: () => Promise<unknown>) =>
    flight.run(async () => {
      try {
        await send();
        void refresh();
        onClose();
      } catch (e) {
        setErrors(stockErrors(e, t));
      }
    });
  const clear = (field: keyof StockErrors) => setErrors((e) => ({ ...e, [field]: undefined, form: undefined }));
  return { errors, saving: flight.pending, run, clear };
}

function StockDialogShell({
  title,
  item,
  after,
  dirty,
  saving,
  canSubmit,
  submitLabel,
  formError,
  onSubmit,
  onClose,
  children,
}: {
  title: string;
  item: AdminItem;
  after: number | null;
  dirty: boolean;
  saving: boolean;
  canSubmit: boolean;
  submitLabel: string;
  formError?: string;
  onSubmit: () => void;
  onClose: () => void;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (canSubmit && !saving) onSubmit();
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} dirty={dirty} dismissible={!saving} className="sheet a-form">
      <form onSubmit={submit} noValidate>
        <div className="sheet-header">
          <DialogTitle className="sheet-title">{title}</DialogTitle>
          <DialogClose asChild>
            <button type="button" className="sheet-close" aria-label={t('common.close')} disabled={saving}>
              ✕
            </button>
          </DialogClose>
        </div>
        <div className="sheet-body">
          <p className="stock-now">
            {t('stock.dialog.current', { qty: item.stock_qty, unit: t(`catalog.units.${item.unit}`) })}
            {after !== null && <span>{t('stock.dialog.after', { qty: after })}</span>}
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
            <button type="button" className="btn" disabled={saving}>
              {t('common.cancel')}
            </button>
          </DialogClose>
          <button type="submit" className="btn btn--primary" disabled={!canSubmit || saving}>
            {saving ? t('stock.dialog.saving') : submitLabel}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

function QtyInput({ label, hint, value, error, min, onChange }: {
  label: string;
  hint?: string;
  value: string;
  error?: string;
  min?: number;
  onChange: (v: string) => void;
}) {
  return (
    <FormField label={label} hint={hint} error={error}>
      {(p) => (
        <input {...p} type="number" inputMode="numeric" step={1} min={min} value={value} onChange={(e) => onChange(e.target.value)} />
      )}
    </FormField>
  );
}

function TextInput({ label, hint, value, error, onChange }: {
  label: string;
  hint?: string;
  value: string;
  error?: string;
  onChange: (v: string) => void;
}) {
  return (
    <FormField label={label} hint={hint} error={error}>
      {(p) => <input {...p} maxLength={500} value={value} onChange={(e) => onChange(e.target.value)} />}
    </FormField>
  );
}

export function StockChangeDialog({ item, mode, onClose }: { item: AdminItem; mode: 'purchase' | 'adjust'; onClose: () => void }) {
  const { t } = useTranslation();
  const { csrfToken } = useMe();
  const { errors, saving, run, clear } = useSubmit(onClose);
  const [qty, setQty] = useState('');
  const [note, setNote] = useState('');
  const delta = toInt(qty);
  const isPurchase = mode === 'purchase';
  // Luật thật ở server (purchase > 0, adjust ≠ 0 + lý do); ở đây chỉ để nút không bấm vô ích
  const validDelta = delta !== null && (isPurchase ? delta > 0 : delta !== 0);
  const canSubmit = validDelta && (isPurchase || note.trim() !== '');
  const send = () =>
    run(() => changeStock(item.id, { delta: delta!, reason: mode, note: note.trim() || null }, csrfToken));

  return (
    <StockDialogShell
      title={t(isPurchase ? 'stock.dialog.purchaseTitle' : 'stock.dialog.adjustTitle', { name: item.name })}
      item={item}
      after={validDelta ? item.stock_qty + delta! : null}
      dirty={qty !== '' || note !== ''}
      saving={saving}
      canSubmit={canSubmit}
      submitLabel={t(isPurchase ? 'stock.dialog.submitPurchase' : 'stock.dialog.submitAdjust')}
      formError={errors.form}
      onSubmit={send}
      onClose={onClose}
    >
      <QtyInput
        label={t(isPurchase ? 'stock.dialog.qty' : 'stock.dialog.delta')}
        hint={isPurchase ? undefined : t('stock.dialog.deltaHint')}
        min={isPurchase ? 1 : undefined}
        value={qty}
        error={errors.qty}
        onChange={(v) => {
          setQty(v);
          clear('qty');
        }}
      />
      <TextInput
        label={t(isPurchase ? 'stock.dialog.note' : 'stock.dialog.adjustReason')}
        hint={t(isPurchase ? 'stock.dialog.noteHint' : 'stock.dialog.adjustReasonHint')}
        value={note}
        error={errors.reason}
        onChange={(v) => {
          setNote(v);
          clear('reason');
        }}
      />
    </StockDialogShell>
  );
}

export function IssueDialog({ item, onClose }: { item: AdminItem; onClose: () => void }) {
  const { t } = useTranslation();
  const { csrfToken } = useMe();
  const { errors, saving, run, clear } = useSubmit(onClose);
  const [qty, setQty] = useState('');
  const [shared, setShared] = useState(false);
  const [recipient, setRecipient] = useState<DirectoryUser | null>(null);
  const [reason, setReason] = useState('');
  const n = toInt(qty);
  const validQty = n !== null && n > 0;
  const hasRecipient = shared || recipient !== null;
  const canSubmit = validQty && hasRecipient && reason.trim() !== '';
  // "Dùng chung" = không gửi recipient_sub (server hiểu rỗng là dùng chung)
  const send = () =>
    run(() =>
      issueStock(
        item.id,
        { qty: n!, ...(shared || !recipient ? {} : { recipient_sub: recipient.sub }), reason: reason.trim() },
        csrfToken,
      ),
    );

  return (
    <StockDialogShell
      title={t('stock.dialog.issueTitle', { name: item.name })}
      item={item}
      after={validQty ? item.stock_qty - n! : null}
      dirty={qty !== '' || reason !== '' || hasRecipient}
      saving={saving}
      canSubmit={canSubmit}
      submitLabel={t('stock.dialog.submitIssue')}
      formError={errors.form}
      onSubmit={send}
      onClose={onClose}
    >
      <QtyInput
        label={t('stock.dialog.qty')}
        min={1}
        value={qty}
        error={errors.qty}
        onChange={(v) => {
          setQty(v);
          clear('qty');
        }}
      />
      <div className="a-check">
        <label>
          <input
            type="checkbox"
            checked={shared}
            onChange={(e) => {
              setShared(e.target.checked);
              clear('recipient');
            }}
          />
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
          onChange={(u) => {
            setRecipient(u);
            clear('recipient');
          }}
        />
      )}
      <TextInput
        label={t('stock.dialog.issueReason')}
        hint={t('stock.dialog.issueReasonHint')}
        value={reason}
        error={errors.reason}
        onChange={(v) => {
          setReason(v);
          clear('reason');
        }}
      />
    </StockDialogShell>
  );
}
