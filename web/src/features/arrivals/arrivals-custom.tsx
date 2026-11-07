import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { apiErrorCode } from '@/lib/api-error';
import { useMe } from '@/lib/me';
import { useSingleFlight } from '@/lib/use-single-flight';
import { parseQty } from './arrival-rows';
import { postCustomReceipt, type PlanCustomRow } from './arrivals.api';

interface Props {
  ym: string;
  // Bản in đang xem: server trả STALE_UPDATE nếu đã có bản mới hơn (như Lưu đợt về)
  snapshotId: string | null;
  rows: PlanCustomRow[];
  admBusy: ReadonlySet<string>;
  onToggleAdm: (key: string, on: boolean) => void;
  onSaved: (error: string | null) => Promise<void>;
}

// Món ngoài danh mục không vào tủ: chỉ ghi "Đã về" để trần giao của khóa đó theo số thật
export function ArrivalsCustom({ ym, snapshotId, rows, admBusy, onToggleAdm, onSaved }: Props) {
  const { t } = useTranslation();
  const { csrfToken } = useMe();
  const flight = useSingleFlight();
  const [raw, setRaw] = useState<Record<string, string>>({});
  if (rows.length === 0) return null;
  const save = (r: PlanCustomRow) =>
    flight.run(async () => {
      const { qty } = parseQty(raw[r.key] ?? '');
      let code: string | null = null;
      try {
        await postCustomReceipt(ym, { line_key: r.key, qty, expected_received: r.received, snapshot_id: snapshotId }, csrfToken);
        setRaw((prev) => ({ ...prev, [r.key]: '' }));
      } catch (e) {
        code = apiErrorCode(e) ?? 'UNKNOWN';
      }
      await onSaved(code);
    });
  return (
    <details className="ar-card ar-fold">
      <summary>{t('arrivals.custom.title', { n: rows.length })}</summary>
      <table className="ar-mini">
        <thead>
          <tr>
            <th scope="col">{t('arrivals.custom.item')}</th>
            <th scope="col" className="n">{t('arrivals.custom.ordered')}</th>
            <th scope="col" className="n">{t('arrivals.custom.received')}</th>
            <th scope="col">{t('arrivals.table.qty')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const text = raw[r.key] ?? '';
            const { qty, error } = parseQty(text);
            return (
              <tr key={r.key}>
                <td>{r.name}</td>
                <td className="n" data-label={t('arrivals.custom.ordered')}>{r.ordered}</td>
                <td className="n" data-label={t('arrivals.custom.received')}>{r.received}</td>
                <td className="ar-qty" data-label={t('arrivals.table.qty')}>
                  <div className="ar-qty__in">
                    <input type="number" inputMode="numeric" min={0} aria-label={t('arrivals.custom.qtyLabel', { name: r.name })} disabled={r.adm_out} value={text} onChange={(e) => setRaw((prev) => ({ ...prev, [r.key]: e.target.value }))} />
                    <button type="button" className="btn btn--sm" aria-label={t('arrivals.custom.saveLabel', { name: r.name })} disabled={r.adm_out || error !== null || qty < 1 || flight.pending} onClick={() => void save(r)}>
                      {t('arrivals.custom.save')}
                    </button>
                    <button
                      type="button"
                      className="ar-adm"
                      aria-pressed={r.adm_out}
                      aria-label={t(r.adm_out_final ? 'arrivals.admOut.finalFor' : 'arrivals.admOut.buttonFor', { name: r.name })}
                      disabled={r.adm_out_final || admBusy.has(r.key)}
                      onClick={() => onToggleAdm(r.key, !r.adm_out)}
                    >
                      {t(r.adm_out_final ? 'arrivals.admOut.final' : 'arrivals.admOut.button')}
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </details>
  );
}
