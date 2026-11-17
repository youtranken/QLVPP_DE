import { useTranslation } from 'react-i18next';
import { Loading, LoadError } from '@/ui/load-state';
import { useRequestFormat } from '@/features/request/request-format';
import type { LineAdjustment, LineView } from '@/features/request/request.api';
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
      {(line.adjustments ?? []).map((a) => (
        <AdjustNote key={a.at} a={a} />
      ))}
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
    </ul>
  );
}
