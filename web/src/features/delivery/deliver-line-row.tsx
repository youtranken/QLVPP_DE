import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMe } from '@/lib/me';
import { useSingleFlight } from '@/lib/use-single-flight';
import type { LineView } from '@/features/request/request.api';
import { useRequestFormat } from '@/features/request/request-format';
import { deliverLine, isDeliverable, remainingOf } from './delivery.api';
import { lineFailure } from './delivery-errors';

interface Cap {
  limit: number;
  message: string;
}

const toInt = (text: string) => (text.trim() !== '' && Number.isInteger(Number(text)) ? Number(text) : null);

function StatusTag({ line }: { line: LineView }) {
  const { t } = useTranslation();
  if (line.review_status === 'pending') return <span className="tag tag--warn">{t('delivery.line.pending')}</span>;
  if (line.review_status === 'rejected') return <span className="tag">{t('delivery.line.rejected')}</span>;
  return <span className="tag tag--ok">{t('delivery.line.done')}</span>;
}

// Luật thật ở server (1…còn lại, đủ tồn); ở đây chỉ để không bấm vô ích và báo đúng ô
function useQtyCheck(text: string, remaining: number, cap: Cap | null) {
  const { t } = useTranslation();
  const n = toInt(text);
  const max = Math.min(remaining, cap?.limit ?? remaining);
  const fail = (error: string | null) => ({ n, max, error, ok: false });
  if (text.trim() === '') return fail(null);
  if (n === null) return fail(t('delivery.line.invalid'));
  if (n < 1) return fail(t('delivery.line.min'));
  if (n > max) return fail(cap && n > cap.limit ? cap.message : t('delivery.line.max', { max }));
  return { n, max, error: null, ok: true };
}

function DeliverForm({ line, name, onNotice, onReload }: {
  line: LineView;
  name: string;
  onNotice: (code: string) => void;
  onReload: () => Promise<unknown>;
}) {
  const { t } = useTranslation();
  const { csrfToken } = useMe();
  const id = useId();
  const remaining = remainingOf(line);
  const [text, setText] = useState(String(remaining));
  const [cap, setCap] = useState<Cap | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const flight = useSingleFlight();
  const check = useQtyCheck(text, remaining, cap);
  const error = failed ?? check.error;

  const send = () =>
    flight.run(async () => {
      setFailed(null);
      try {
        await deliverLine(line.id, { qty: check.n!, expected_delivered_qty: line.delivered_qty }, csrfToken);
        await onReload();
      } catch (e) {
        const failure = lineFailure(e, t);
        if (failure.kind === 'request') onNotice(failure.code);
        else if (failure.limit !== undefined) setCap({ limit: failure.limit, message: failure.message });
        else setFailed(failure.message);
        if (failure.kind === 'field' && failure.stale) void onReload();
      }
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

export function DeliverLineRow({ line, onNotice, onReload }: {
  line: LineView;
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
      {open ? <DeliverForm line={line} name={name} onNotice={onNotice} onReload={onReload} /> : <StatusTag line={line} />}
    </li>
  );
}
