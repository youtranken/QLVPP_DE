import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { formatVnStamp } from '@/lib/format-time';
import { monthOf } from '@/features/request/request-format';
import { useRequestFormat } from '@/features/request/request-format';
import type { ArrivalsPlan, PlanBatch, PlanRow } from './arrivals.api';

export function BatchList({ batches }: { batches: PlanBatch[] }) {
  const { t } = useTranslation();
  const cols = ['at', 'actor', 'items', 'units', 'note'] as const;
  return (
    <table className="ar-batches" aria-label={t('arrivals.batches.title')}>
      <caption>{t('arrivals.batches.title')}</caption>
      <thead>
        <tr>
          {cols.map((c) => (
            <th key={c} scope="col" className={c === 'items' || c === 'units' ? 'n' : undefined}>
              {t(`arrivals.batches.${c}`)}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {batches.map((b) => (
          <tr key={`${b.at}-${b.actor_name ?? ''}`}>
            <td data-label={t('arrivals.batches.at')}>{formatVnStamp(b.at)}</td>
            <td data-label={t('arrivals.batches.actor')}>{b.actor_name ?? t('common.empty')}</td>
            <td className="n" data-label={t('arrivals.batches.items')}>{b.items}</td>
            <td className="n" data-label={t('arrivals.batches.units')}>{b.units}</td>
            <td data-label={t('arrivals.batches.note')}>{b.note ?? t('common.empty')}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// Mọi hàng đã về đủ hoặc được bỏ qua: không bày bảng số 0, chỉ báo xong và các đợt đã nhập
interface DoneProps {
  plan: ArrivalsPlan;
  ym: string;
  admBusy: ReadonlySet<string>;
  onToggleAdm: (key: string, on: boolean) => void;
}

// Hàng ADM hết hàng vẫn bỏ đánh dấu được tới khi xử lý xong, nên vẫn có nút dù không còn bảng số
function OutList({ rows, admBusy, onToggleAdm }: { rows: PlanRow[]; admBusy: ReadonlySet<string>; onToggleAdm: (key: string, on: boolean) => void }) {
  const { t } = useTranslation();
  const fmt = useRequestFormat();
  return (
    <ul className="ar-outlist">
      {rows.map((r) => (
        <li key={r.key}>
          <span>
            <b>{fmt.name(r)}</b>
            {r.received < r.ordered && <small className="ar-note">{t('arrivals.admOutStock', { s: r.stock_qty })}</small>}
          </span>
          <button
            type="button"
            className="ar-adm"
            aria-pressed
            aria-label={t(r.adm_out_final ? 'arrivals.admOut.finalFor' : 'arrivals.admOut.buttonFor', { name: fmt.name(r) })}
            disabled={r.adm_out_final || admBusy.has(r.key)}
            onClick={() => onToggleAdm(r.key, false)}
          >
            {t(r.adm_out_final ? 'arrivals.admOut.final' : 'arrivals.admOut.button')}
          </button>
        </li>
      ))}
    </ul>
  );
}

export function ArrivalsDone({ plan, ym, admBusy, onToggleAdm }: DoneProps) {
  const { t } = useTranslation();
  const out = plan.rows.filter((r) => r.adm_out);
  // Món trong danh mục và ngoài DM đếm chung một tập: số món, đơn vị và "NCC hết hàng" cộng lại khớp nhau
  const all = [...plan.rows, ...plan.custom];
  const got = all.filter((r) => r.received > 0);
  const units = got.reduce((n, r) => n + r.received, 0);
  const last = plan.batches[0]?.at;
  // "Đã về đủ" chỉ khi không món nào NCC hết hàng mà còn thiếu
  const outShort = all.filter((r) => r.adm_out && r.received < r.ordered).length;
  const vars = { month: monthOf(ym), x: got.length, y: units, out: outShort, time: last ? formatVnStamp(last) : t('common.empty') };
  return (
    <section className="ar-card ar-done">
      <div role="status" className="ar-done__head">
        <p>{t(outShort > 0 ? 'arrivals.done.titleOut' : 'arrivals.done.title', vars)}</p>
        <Link className="btn btn--primary" to="/admin/delivery">
          {t('arrivals.done.next')}
        </Link>
      </div>
      {out.length > 0 && <OutList rows={out} admBusy={admBusy} onToggleAdm={onToggleAdm} />}
      {plan.batches.length > 0 && <BatchList batches={plan.batches} />}
    </section>
  );
}
