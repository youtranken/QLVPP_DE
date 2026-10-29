import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMe } from '@/lib/me';
import { useSingleFlight } from '@/lib/use-single-flight';
import type { LineView } from '@/features/request/request.api';
import { useRequestFormat } from '@/features/request/request-format';
import { deliverLine, isDeliverable, remainingOf } from './delivery.api';
import { lineFailure } from './delivery-errors';
import { useQtyCheck, type Cap } from './use-deliver-qty';

function StatusTag({ line }: { line: LineView }) {
  const { t } = useTranslation();
  if (line.review_status === 'pending') return <span className="tag tag--warn">{t('delivery.line.pending')}</span>;
  if (line.review_status === 'rejected') return <span className="tag">{t('delivery.line.rejected')}</span>;
  return <span className="tag tag--ok">{t('delivery.line.done')}</span>;
}

// Mức trần STOCK_INSUFFICIENT chỉ đúng với bản phiếu lúc nhận lỗi; tải lại phiếu (version mới) thì bỏ
function DeliverForm({ line, name, version, onNotice, onReload }: {
  line: LineView;
  name: string;
  version: number;
  onNotice: (code: string) => void;
  onReload: () => Promise<unknown>;
}) {
  const { t } = useTranslation();
  const { csrfToken } = useMe();
  const id = useId();
  const remaining = remainingOf(line);
  const [text, setText] = useState(String(remaining));
  const [cap, setCap] = useState<(Cap & { version: number }) | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const flight = useSingleFlight();
  const check = useQtyCheck(text, remaining, cap?.version === version ? cap : null);
  const error = failed ?? check.error;

  const send = () =>
    flight.run(async () => {
      setFailed(null);
      try {
        await deliverLine(line.id, { qty: check.n!, expected_delivered_qty: line.delivered_qty }, csrfToken);
      } catch (e) {
        const failure = lineFailure(e, t);
        if (failure.kind === 'request') onNotice(failure.code);
        else if (failure.limit !== undefined) setCap({ limit: failure.limit, message: failure.message, version });
        else setFailed(failure.message);
        if (failure.kind === 'field' && failure.stale) void onReload();
        return;
      }
      // Đã giao xong: tải lại lỗi thì phiếu tự hiện lỗi tải, không báo nhầm là giao thất bại
      await onReload().catch(() => undefined);
    });

  return (
    <div className="dl-form">
      <div className="dl-act">
        <label className="dl-qty-label" htmlFor={id}>
          {t('delivery.line.qty')}
        </label>
        <input
          id={id}
          className="a-input dl-qty num"
          type="number"
          inputMode="numeric"
          step={1}
          min={1}
          max={check.max}
          value={text}
          aria-label={t('delivery.line.qtyLabel', { name })}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-err` : undefined}
          onChange={(e) => {
            setText(e.target.value);
            setFailed(null);
          }}
        />
        <button
          type="button"
          className="btn btn--sm btn--primary"
          aria-label={t('delivery.line.deliverLabel', { name })}
          disabled={!check.ok || flight.pending}
          onClick={() => void send()}
        >
          {t('delivery.line.deliver')}
        </button>
      </div>
      {error && (
        <p id={`${id}-err`} className="ff-error">
          {error}
        </p>
      )}
    </div>
  );
}

export function DeliverLineRow({ line, version, onNotice, onReload }: {
  line: LineView;
  version: number;
  onNotice: (code: string) => void;
  onReload: () => Promise<unknown>;
}) {
  const { t } = useTranslation();
  const fmt = useRequestFormat();
  const name = line.item ? fmt.name(line.item) : (line.custom_name ?? '');
  const unit = fmt.unit(line.item?.unit ?? line.custom_unit);
  const open = isDeliverable(line) && remainingOf(line) > 0;
  return (
    <li className="dl-line">
      <div className="dl-line-main">
        <span className="dl-name">{name}</span> {unit && <small className="dl-unit">· {unit}</small>}
        {isDeliverable(line) && (
          <small className="dl-progress">
            <span>{t('delivery.line.progress', { done: line.delivered_qty, total: line.qty })}</span>
            {line.cancelled_qty > 0 && <span>{t('delivery.line.cancelled', { n: line.cancelled_qty })}</span>}
            {open && <span>{t('delivery.line.remaining', { n: remainingOf(line) })}</span>}
          </small>
        )}
      </div>
      {open ? <DeliverForm line={line} name={name} version={version} onNotice={onNotice} onReload={onReload} /> : <StatusTag line={line} />}
    </li>
  );
}
