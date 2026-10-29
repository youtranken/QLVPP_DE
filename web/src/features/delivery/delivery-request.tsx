import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { apiErrorCode } from '@/lib/api-error';
import { useMe } from '@/lib/me';
import { useSingleFlight } from '@/lib/use-single-flight';
import { Loading, LoadError } from '@/ui/load-state';
import type { LineView } from '@/features/request/request.api';
import { useRequestFormat } from '@/features/request/request-format';
import { useAdminRequest } from '@/features/summary/summary.api';
import { deliverAll, isDeliverable, remainingOf, useRefreshAfterDelivery, type DeliverAllResult } from './delivery.api';
import { noticeOf } from './delivery-errors';
import { DeliverLineRow } from './deliver-line-row';

interface Outcome {
  delivered: number;
  failed: string[];
  skipped: string[];
}

// Dòng chờ xem/bị từ chối luôn nằm trong failed[] của api: là thông tin, không phải lỗi giao
const SKIP_CODES = new Set(['LINE_NOT_REVIEWED', 'LINE_REJECTED']);

// Tên lấy từ bản phiếu lúc bấm: bản tải lại sau đó có thể đã đổi dòng
function useOutcomeOf() {
  const { t } = useTranslation();
  const fmt = useRequestFormat();
  return (result: DeliverAllResult, lines: LineView[]): Outcome => {
    const byId = new Map(lines.map((l) => [l.id, l]));
    const nameOf = (id: string) => {
      const l = byId.get(id);
      return l?.item ? fmt.name(l.item) : (l?.custom_name ?? '');
    };
    const reasonOf = (f: DeliverAllResult['failed'][number]) =>
      t(`delivery.all.reasons.${f.code}`, { available: f.available ?? 0, defaultValue: noticeOf(f.code, t) });
    return {
      delivered: result.delivered.length,
      failed: result.failed
        .filter((f) => !SKIP_CODES.has(f.code))
        .map((f) => t('delivery.all.failed', { name: nameOf(f.line_id), reason: reasonOf(f) })),
      skipped: result.failed
        .filter((f) => SKIP_CODES.has(f.code))
        .map((f) => t('delivery.all.skipped', { name: nameOf(f.line_id), reason: reasonOf(f) })),
    };
  };
}

function OutcomeBox({ outcome }: { outcome: Outcome }) {
  const { t } = useTranslation();
  return (
    <div role="status" className={`alert ${outcome.failed.length > 0 ? 'alert--warn' : 'alert--ok'} dl-result`}>
      <p>{t('delivery.all.delivered', { n: outcome.delivered })}</p>
      {outcome.failed.length > 0 && (
        <ul aria-label={t('delivery.all.failedList')}>
          {outcome.failed.map((text, i) => (
            <li key={i}>{text}</li>
          ))}
        </ul>
      )}
      {outcome.skipped.length > 0 && (
        <ul aria-label={t('delivery.all.skippedList')} className="dl-skipped">
          {outcome.skipped.map((text, i) => (
            <li key={i}>{text}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function DeliveryRequest({ requestId, name }: { requestId: string; name: string }) {
  const { t } = useTranslation();
  const { csrfToken } = useMe();
  const query = useAdminRequest(requestId);
  const refresh = useRefreshAfterDelivery();
  const outcomeOf = useOutcomeOf();
  const [notice, setNotice] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const flight = useSingleFlight();
  const view = query.data;

  const reload = () => refresh(requestId);
  const afterLine = () => {
    setNotice(null);
    return reload();
  };
  const onNotice = (code: string) => {
    setOutcome(null);
    setNotice(noticeOf(code, t));
    void reload();
  };

  const sendAll = (lines: LineView[]) =>
    flight.run(async () => {
      setNotice(null);
      setOutcome(null);
      try {
        setOutcome(outcomeOf(await deliverAll(requestId, csrfToken), lines));
        await reload();
      } catch (e) {
        setNotice(noticeOf(apiErrorCode(e) ?? '', t));
      }
    });

  if (query.isError) return <LoadError onRetry={() => void query.refetch()} />;
  if (!view) return <Loading />;
  const canDeliverAll = view.lines.some((l) => isDeliverable(l) && remainingOf(l) > 0);

  return (
    <div className="dl-request">
      {notice && (
        <p role="alert" className="alert alert--warn">
          {notice}
        </p>
      )}
      {outcome && <OutcomeBox outcome={outcome} />}
      <ul className="dl-lines" aria-label={t('delivery.lines', { name })}>
        {view.lines.map((l) => (
          // Key theo số đã giao/hủy: bản phiếu mới đặt lại ô "Thực giao" về phần còn lại mới
          <DeliverLineRow key={`${l.id}:${l.delivered_qty}:${l.cancelled_qty}`} line={l} onNotice={onNotice} onDelivered={afterLine} />
        ))}
      </ul>
      <div className="dl-request-foot">
        <button type="button" className="btn btn--primary" disabled={!canDeliverAll || flight.pending} onClick={() => void sendAll(view.lines)}>
          {flight.pending ? t('delivery.all.sending') : t('delivery.all.button')}
        </button>
      </div>
    </div>
  );
}
