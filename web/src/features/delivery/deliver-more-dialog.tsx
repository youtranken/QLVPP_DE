import { useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useMe } from '@/lib/me';
import { useSingleFlight } from '@/lib/use-single-flight';
import { Dialog, DialogClose, DialogDescription, DialogTitle } from '@/ui/dialog';
import { FormField } from '@/ui/form-field';
import type { BacklogLine } from './backlog.api';
import { useBacklogFormat } from './backlog-format';
import { deliverLine } from './delivery.api';
import { lineFailure } from './delivery-errors';
import { useQtyCheck, type Cap } from './use-deliver-qty';

interface Props {
  line: BacklogLine;
  onDone: () => Promise<unknown>;
  onNotice: (code: string) => void;
  onClose: () => void;
}

// Dòng ngoài danh mục không có tồn kho (stock_qty null) nên chỉ giới hạn bởi phần còn lại
export function DeliverMoreDialog({ line, onDone, onNotice, onClose }: Props) {
  const { t } = useTranslation();
  const { csrfToken } = useMe();
  const f = useBacklogFormat();
  const stockCap = line.stock_qty === null ? null : { limit: line.stock_qty, message: t('delivery.line.available', { available: line.stock_qty }) };
  const [text, setText] = useState(String(Math.min(line.remaining_qty, line.stock_qty ?? line.remaining_qty)));
  const [cap, setCap] = useState<Cap | null>(stockCap);
  const [failed, setFailed] = useState<string | null>(null);
  const flight = useSingleFlight();
  const check = useQtyCheck(text, line.remaining_qty, cap);
  const error = failed ?? check.error ?? undefined;
  const month = f.month(line.period_ym);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!check.ok) return;
    void flight.run(async () => {
      setFailed(null);
      try {
        await deliverLine(line.line_id, { qty: check.n!, expected_delivered_qty: line.delivered_qty }, csrfToken);
        await onDone();
      } catch (err) {
        const failure = lineFailure(err, t);
        if (failure.kind === 'request') onNotice(failure.code);
        else if (failure.limit !== undefined) setCap({ limit: failure.limit, message: failure.message });
        else setFailed(failure.message);
      }
    });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} dismissible={!flight.pending} className="sheet a-form" maxWidth={440}>
      <form onSubmit={submit} noValidate>
        <div className="sheet-header">
          <DialogTitle className="sheet-title">{t('delivery.backlog.deliver.title', { name: f.name(line), person: f.person(line) })}</DialogTitle>
          <DialogClose asChild>
            <button type="button" className="sheet-close" aria-label={t('common.close')} disabled={flight.pending}>
              ✕
            </button>
          </DialogClose>
        </div>
        <div className="sheet-body">
          <DialogDescription className="bl-meta">
            {line.stock_qty === null
              ? t('delivery.backlog.deliver.meta', { month, n: line.remaining_qty })
              : t('delivery.backlog.deliver.metaStock', { month, n: line.remaining_qty, stock: line.stock_qty })}
          </DialogDescription>
          <FormField label={t('delivery.backlog.deliver.qty')} error={error}>
            {(p) => (
              <input
                {...p}
                className="a-input num bl-qty"
                type="number"
                inputMode="numeric"
                step={1}
                min={1}
                max={check.max}
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  setFailed(null);
                }}
              />
            )}
          </FormField>
        </div>
        <div className="sheet-footer">
          <DialogClose asChild>
            <button type="button" className="btn" disabled={flight.pending}>
              {t('common.cancel')}
            </button>
          </DialogClose>
          <button type="submit" className="btn btn--primary" disabled={!check.ok || flight.pending} aria-busy={flight.pending}>
            {t('delivery.backlog.deliver.submit')}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
