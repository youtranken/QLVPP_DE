import { useTranslation } from 'react-i18next';
import type { Tone } from '@/lib/group-tone';
import { ItemThumb } from '@/ui/item-thumb';
import { useRequestFormat } from '@/features/request/request-format';
import { arrivalTag, parseQty, type ArrivalRow, type ArrivalTag } from './arrival-rows';

const TAG_CLASS: Record<ArrivalTag, string> = { short: 'tag--warn', over: 'tag--info', exact: 'tag--ok' };
const THUMB_TONE: Tone = 'g0';

interface Props {
  rows: ArrivalRow[];
  // Giá trị gõ dở của từng ô; thiếu thì lấy qty của dòng
  raw: Record<string, string>;
  onChange: (itemId: string, value: string) => void;
}

export function ArrivalTable({ rows, raw, onChange }: Props) {
  const { t } = useTranslation();
  const fmt = useRequestFormat();
  const n = (v: number) => v.toLocaleString('vi-VN');
  return (
    <table className="ar-table" aria-label={t('arrivals.table.label')}>
      <thead>
        <tr>
          <th scope="col">{t('arrivals.table.item')}</th>
          <th scope="col" className="n">{t('arrivals.table.waiting')}</th>
          <th scope="col" className="n">{t('arrivals.table.stock')}</th>
          <th scope="col" className="n">{t('arrivals.table.qty')}</th>
          <th scope="col">{t('arrivals.table.status')}</th>
          <th scope="col" className="n">{t('arrivals.table.after')}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const text = raw[r.item_id] ?? String(r.qty);
          const { error } = parseQty(text);
          const errId = `ar-err-${r.item_id}`;
          const tag = arrivalTag(r);
          return (
            <tr key={r.item_id}>
              <td className="ar-item">
                <ItemThumb fileId={r.image_file_id} alt="" tone={THUMB_TONE} size={36} />
                <span>
                  <b>{r.name}</b>
                  <small>{fmt.unit(r.unit)}</small>
                </span>
              </td>
              <td className="n" data-label={t('arrivals.table.waiting')}>{n(r.waiting)}</td>
              <td className="n" data-label={t('arrivals.table.stock')}>{n(r.stock)}</td>
              <td className="n ar-qty" data-label={t('arrivals.table.qty')}>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  aria-label={t('arrivals.table.qtyLabel', { name: r.name })}
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? errId : undefined}
                  value={text}
                  onChange={(e) => onChange(r.item_id, e.target.value)}
                />
                {error && (
                  <small id={errId} className="ar-err">
                    {t(`arrivals.errors.${error}`)}
                  </small>
                )}
              </td>
              <td data-label={t('arrivals.table.status')}>
                <span className={`tag ${TAG_CLASS[tag]}`}>{t(`arrivals.tag.${tag}`)}</span>
              </td>
              <td className="n ar-after" data-label={t('arrivals.table.after')}>{n(r.stock + r.qty)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
