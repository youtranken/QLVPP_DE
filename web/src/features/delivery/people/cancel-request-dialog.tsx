import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiError } from '@/lib/api-client';
import { useMe } from '@/lib/me';
import { undoActions } from '@/lib/undo.api';
import { useSingleFlight } from '@/lib/use-single-flight';
import { Dialog, DialogClose, DialogDescription, DialogTitle } from '@/ui/dialog';
import { useToast } from '@/ui/toast-context';
import { useRequestFormat } from '@/features/request/request-format';
import { cancelUserRequests, type CancelRequestResult } from '../delivery.api';
import type { DeliveryPerson } from './delivery-people.api';
import { useRefreshAfterLineChange } from './use-refresh-after-flow';
import { cancellableLines } from './cancel-request-lines';

const isStale = (e: unknown) => e instanceof ApiError && (e.body as { code?: string } | null)?.code === 'STALE_UPDATE';

export function CancelRequestDialog({ person, onClose, onDone }: { person: DeliveryPerson; onClose: () => void; onDone: () => void }) {
  const { t } = useTranslation();
  const fmt = useRequestFormat();
  const { csrfToken } = useMe();
  const toast = useToast();
  const refresh = useRefreshAfterLineChange([['admin-request']]);
  const flight = useSingleFlight();
  const [error, setError] = useState<string | null>(null);
  // Chụp lúc mở: số gửi đi là số đang hiện; sau STALE_UPDATE chụp lại từ dữ liệu vừa tải
  const [lines, setLines] = useState(() => cancellableLines(person));
  const [reloading, setReloading] = useState(false);
  const sentFrom = useRef(person);
  useEffect(() => {
    // Chờ bản person mới hơn bản lúc gửi (refetch xong) rồi chụp đúng một lần
    if (!reloading || person === sentFrom.current) return;
    setLines(cancellableLines(person));
    setReloading(false);
  }, [person, reloading]);
  const delivered = person.lines.filter((l) => l.delivered_qty > 0);
  const name = person.full_name ?? person.user_sub;

  const submit = () =>
    flight.run(async () => {
      setError(null);
      setReloading(false);
      sentFrom.current = person;
      const sentAt = Date.now();
      let res: CancelRequestResult;
      try {
        const expected = lines.map((l) => ({ line_id: l.line_id, remaining: l.remaining_qty }));
        res = await cancelUserRequests(person.user_sub, expected, csrfToken);
      } catch (e) {
        const stale = isStale(e);
        await refresh();
        setReloading(stale);
        return setError(t(stale ? 'delivery.cancelRequest.stale' : 'delivery.cancelRequest.failed'));
      }
      const undoId = res.undo_id;
      toast.show({
        text: res.cancelled_now === 0 ? t('delivery.cancelRequest.already') : t('delivery.cancelRequest.done', { name, count: res.lines.length }),
        undo: undoId ? () => undoActions('cancel', [undoId], csrfToken).then(refresh) : undefined,
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
        <button type="button" className="btn btn--danger" disabled={flight.pending || lines.length === 0} aria-busy={flight.pending} onClick={() => void submit()}>
          {flight.pending ? t('delivery.cancelRequest.sending') : t('delivery.cancelRequest.confirm')}
        </button>
      </div>
    </Dialog>
  );
}
