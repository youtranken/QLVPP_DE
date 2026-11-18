import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiError } from '@/lib/api-client';
import { useMe } from '@/lib/me';
import { undoActions } from '@/lib/undo.api';
import { useSingleFlight } from '@/lib/use-single-flight';
import { Dialog, DialogClose, DialogDescription, DialogTitle } from '@/ui/dialog';
import { useToast } from '@/ui/toast-context';
import { useRequestFormat } from '@/features/request/request-format';
import { cancelRequest } from '../delivery.api';
import type { DeliveryPerson, DeliveryPersonLine } from './delivery-people.api';
import { useRefreshAfterLineChange } from './use-refresh-after-flow';
import { cancellableLines } from './cancel-request-lines';

// Một người có thể có phiếu tháng đang giao và phiếu nợ tháng trước: mỗi phiếu một lần gọi
function byRequest(lines: DeliveryPersonLine[]) {
  const groups = new Map<string, { line_id: string; remaining: number }[]>();
  for (const l of lines) groups.set(l.request_id, [...(groups.get(l.request_id) ?? []), { line_id: l.line_id, remaining: l.remaining_qty }]);
  return [...groups];
}

const isStale = (e: unknown) => e instanceof ApiError && (e.body as { code?: string } | null)?.code === 'STALE_UPDATE';

export function CancelRequestDialog({ person, onClose, onDone }: { person: DeliveryPerson; onClose: () => void; onDone: () => void }) {
  const { t } = useTranslation();
  const fmt = useRequestFormat();
  const { csrfToken } = useMe();
  const toast = useToast();
  const refresh = useRefreshAfterLineChange([['admin-request']]);
  const flight = useSingleFlight();
  const [error, setError] = useState<string | null>(null);
  // Chụp lúc mở: số gửi đi là số đang hiện
  const [lines] = useState(() => cancellableLines(person));
  const delivered = person.lines.filter((l) => l.delivered_qty > 0);
  const name = person.full_name ?? person.user_sub;

  const submit = () =>
    flight.run(async () => {
      setError(null);
      const sentAt = Date.now();
      const undoIds: string[] = [];
      try {
        for (const [requestId, expected] of byRequest(lines)) {
          const res = await cancelRequest(requestId, expected, csrfToken);
          if (res.undo_id) undoIds.push(res.undo_id);
        }
      } catch (e) {
        await refresh();
        return setError(t(isStale(e) ? 'delivery.cancelRequest.stale' : 'delivery.cancelRequest.failed'));
      }
      toast.show({
        text: t('delivery.cancelRequest.done', { name, count: lines.length }),
        undo: undoIds.length > 0 ? () => undoActions('cancel', undoIds, csrfToken).then(refresh) : undefined,
        undoSince: sentAt,
      });
      onDone();
      await refresh();
    });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} dismissible={!flight.pending} className="sheet a-form" maxWidth={480}>
      <div className="sheet-header">
        <DialogTitle className="sheet-title">{t('delivery.cancelRequest.title', { name })}</DialogTitle>
      </div>
      <div className="sheet-body">
        <DialogDescription>{t('delivery.cancelRequest.lead')}</DialogDescription>
        <table className="table">
          <tbody>
            {lines.map((l) => (
              <tr key={l.line_id}>
                <td>{fmt.name(l)}</td>
                <td className="r num">{t('delivery.cancelRequest.qty', { qty: l.remaining_qty, unit: fmt.unit(l.unit) })}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {delivered.length > 0 && (
          <p className="dd-note">
            {t('delivery.cancelRequest.kept', { list: delivered.map((l) => `${l.delivered_qty} ${fmt.unit(l.unit)} ${fmt.name(l)}`).join(', ') })}
          </p>
        )}
        {error && (
          <p role="alert" className="ff-error">
            {error}
          </p>
        )}
      </div>
      <div className="sheet-footer">
        <DialogClose asChild>
          <button type="button" className="btn btn--ghost" disabled={flight.pending}>
            {t('delivery.cancelRequest.back')}
          </button>
        </DialogClose>
        <button type="button" className="btn btn--danger" disabled={flight.pending || !!error} aria-busy={flight.pending} onClick={() => void submit()}>
          {flight.pending ? t('delivery.cancelRequest.sending') : t('delivery.cancelRequest.confirm')}
        </button>
      </div>
    </Dialog>
  );
}
