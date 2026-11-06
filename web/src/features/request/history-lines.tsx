import { useTranslation } from 'react-i18next';
import { LoadError } from '@/ui/load-state';
import { ItemThumb } from '@/ui/item-thumb';
import { useMyRequest, type LineView } from './request.api';
import { counted, useRequestFormat } from './request-format';
import { Chip, ReviewTag, type ChipTone } from './history-chip';

function LineChips({ line }: { line: LineView }) {
  const { t } = useTranslation();
  if (!counted(line)) return <span className="hs-chips"><ReviewTag line={line} /></span>;
  const owed = line.qty - line.delivered_qty - line.cancelled_qty;
  const a = line.delivered_qty;
  const reason = line.cancel_note?.trim();
  const chips: [ChipTone, string][] = [];
  if (a > 0 && owed === 0 && line.cancelled_qty === 0) chips.push(['ok', t('request.history.line.full')]);
  else if (a > 0 && owed > 0) chips.push(['warn', t('request.history.line.part', { a, b: owed })]);
  else if (a > 0) chips.push(['ok', t('request.history.line.got', { a })]);
  else if (owed > 0) chips.push(['warn', t('request.history.line.wait', { b: owed })]);
  if (line.cancelled_qty > 0) {
    const key = reason ? 'cancelledAllWhy' : 'cancelledAll';
    chips.push(['danger', t(`request.history.${key}`, { n: line.cancelled_qty, reason })]);
  }
  return (
    <span className="hs-chips">
      {chips.map(([tone, text]) => (
        <Chip key={text} tone={tone}>
          {text}
        </Chip>
      ))}
    </span>
  );
}

function Line({ line }: { line: LineView }) {
  const { t } = useTranslation();
  const fmt = useRequestFormat();
  const name = line.item ? fmt.name(line.item) : (line.custom_name ?? '');
  const unit = fmt.unit(line.item?.unit ?? line.custom_unit);
  return (
    <li className="hs-item">
      <ItemThumb fileId={line.item?.image_file_id ?? line.image_file_id} alt="" tone="g0" size={42} />
      <span className="hs-item-text">
        <span className="hs-item-name">{name}</span>
        <span className="hs-item-qty">{t('request.cart.qty', { qty: line.qty, unit })}</span>
      </span>
      <LineChips line={line} />
    </li>
  );
}

// Tháng gần nhất đã đóng: liệt kê dòng món ngay trong thẻ
export function LatestLines({ ym }: { ym: string }) {
  const request = useMyRequest(ym);
  if (request.isError) return <LoadError onRetry={() => void request.refetch()} />;
  const lines = request.data?.lines ?? [];
  if (lines.length === 0) return null;
  return (
    <ul className="hs-items">
      {lines.map((l) => (
        <Line key={l.id} line={l} />
      ))}
    </ul>
  );
}
