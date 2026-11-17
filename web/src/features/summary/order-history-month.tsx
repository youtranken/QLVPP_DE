import { useTranslation } from 'react-i18next';
import { Loading, LoadError } from '@/ui/load-state';
import { useRequestFormat } from '@/features/request/request-format';
import type { LineAdjustment, LineView, RemovedLine } from '@/features/request/request.api';
import { useRegistration } from './summary.api';

function AdjustNote({ a }: { a: LineAdjustment }) {
  const { t } = useTranslation();
  const reason = t(`adjustReason.${a.reason_code}`);
  const text = a.after === 0 ? t('summary.history.removed', { reason }) : t('summary.history.reduced', { before: a.before, after: a.after, reason });
  return <small className="oh-adjust">{a.reason_note ? `${text}: ${a.reason_note}` : text}</small>;
}

function Line({ line }: { line: LineView }) {
  const fmt = useRequestFormat();
  const name = line.item ? fmt.name(line.item) : (line.custom_name ?? '');
  return (
    <li className="oh-line">
      <span className="oh-line__name">{name}</span>
      <b className="num">{`${line.qty} ${fmt.unit(line.item?.unit ?? line.custom_unit)}`}</b>
      {(line.adjustments ?? []).map((a, i) => (
        <AdjustNote key={i} a={a} />
      ))}
    </li>
  );
}

// Dòng Adm D&E bỏ hẳn không còn trong lines: hiện số 0 kèm lý do để popup đủ mọi điều chỉnh
function RemovedRow({ line }: { line: RemovedLine }) {
  const fmt = useRequestFormat();
  return (
    <li className="oh-line">
      <span className="oh-line__name">{fmt.name(line)}</span>
      <b className="num">{`0 ${fmt.unit(line.unit)}`}</b>
      <AdjustNote a={{ ...line, after: 0 }} />
    </li>
  );
}

export function OrderHistoryMonth({ ym, requestId }: { ym: string; requestId: string | undefined }) {
  const { t } = useTranslation();
  const view = useRegistration(ym, requestId);
  if (!requestId) return <p className="oh-empty">{t('summary.history.none')}</p>;
  if (view.isError) return <LoadError onRetry={() => void view.refetch()} />;
  if (!view.data) return <Loading />;
  const lines = view.data.lines.filter((l) => l.review_status !== 'rejected');
  return (
    <ul className="oh-lines" aria-label={t('summary.history.lines')}>
      {lines.map((l) => (
        <Line key={l.id} line={l} />
      ))}
      {(view.data.removed_lines ?? []).map((l, i) => (
        <RemovedRow key={`removed-${i}`} line={l} />
      ))}
    </ul>
  );
}
