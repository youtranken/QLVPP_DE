import { useTranslation } from 'react-i18next';
import { formatVnStamp } from '@/lib/format-time';
import { EmptyValue } from '@/ui/empty-cell';
import type { LineView } from './request.api';
import { ReviewTag } from './history-chip';
import type { ReceiveRow } from './receive-rows';
import { noteText } from './history-notes';

type T = ReturnType<typeof useTranslation>['t'];

// Còn chờ: số còn chờ; không giao / tạm ngưng thì nói bằng chữ thay vì số 0
export function WaitingCell({ row }: { row: ReceiveRow }) {
  const { t } = useTranslation();
  if (row.state === 'paused') return <span className="rq-recv-st is-none">{t('common.paused')}</span>;
  if (row.state === 'none') return <span className="rq-recv-st is-none">{t('request.receive.none')}</span>;
  return <span className={row.waiting > 0 ? 'rq-recv-st is-wait' : undefined}>{row.waiting}</span>;
}

export function LastReceived({ row }: { row: ReceiveRow }) {
  return row.received > 0 && row.receivedAt ? <>{formatVnStamp(row.receivedAt)}</> : <EmptyValue />;
}

function lineText(row: ReceiveRow, t: T): string {
  if (row.state === 'paused') return t('common.paused');
  if (row.state === 'none') return t('request.receive.none');
  return t('request.history.lineProgress', { received: row.received, waiting: row.waiting });
}

// Điện thoại: mỗi món một dòng "tên · sl đvt — đã nhận a, còn chờ b" thay cho thẻ nhiều cặp nhãn–giá trị
export function HistoryLines({
  label,
  rows,
  held,
  lineById,
  unit,
}: {
  label: string;
  rows: ReceiveRow[];
  held: LineView[];
  lineById: Map<string, LineView>;
  unit: (code: string | null) => string;
}) {
  const { t } = useTranslation();
  return (
    <ul className="hs-lines" aria-label={label}>
      {rows.map((r) => {
        const line = lineById.get(r.id);
        const note = noteText(r, line, t);
        return (
          <li key={r.id}>
            <b>{r.name}</b> · {r.registered} {unit(r.unit)} — <span className={r.waiting > 0 ? 'hs-lines-wait' : undefined}>{lineText(r, t)}</span>
            {line && <ReviewTag line={line} />}
            {note && <small>{note}</small>}
          </li>
        );
      })}
      {held.map((l) => (
        <li key={l.id}>
          <b>{l.custom_name ?? ''}</b> · {l.qty} {unit(l.custom_unit)} <ReviewTag line={l} />
        </li>
      ))}
    </ul>
  );
}
