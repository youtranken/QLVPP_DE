import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { apiErrorCode } from '@/lib/api-error';
import { useMe } from '@/lib/me';
import { useSingleFlight } from '@/lib/use-single-flight';
import { monthOf, useRequestFormat } from '@/features/request/request-format';
import { parseQty } from './arrival-rows';
import { postCustomReceipt, postReceipt, setOwedClosed, type PlanMakeupGroup, type PlanMakeupRow } from './arrivals.api';

interface Props {
  groups: PlanMakeupGroup[];
  onDone: (error: string | null, saved?: number, failedYm?: string) => Promise<void>;
}

const idOf = (ym: string, key: string) => `${ym}|${key}`;

class MakeupFailed extends Error {
  readonly ym: string;
  readonly saved: number;
  readonly code: string;
  constructor(ym: string, saved: number, code: string) {
    super(ym);
    this.ym = ym;
    this.saved = saved;
    this.code = code;
  }
}

// Mỗi kỳ cũ một lần nhập (receipt_ym = kỳ đó); cùng món ở hai kỳ thì tủ dự kiến cộng dồn để lần sau không lệch.
// Lưu xong lần nào xóa ô của lần đó ngay: lỗi ở kỳ sau thì bấm lại không nhập trùng kỳ trước
async function saveMakeup(groups: PlanMakeupGroup[], qtyOf: (ym: string, r: PlanMakeupRow) => number, csrf: string | null, cleared: (ids: string[]) => void) {
  const stock = new Map<string, number>();
  let saved = 0;
  for (const g of groups) {
    const picked = g.rows.filter((r) => qtyOf(g.ym, r) > 0);
    const items = picked.filter((r) => r.item_id !== null);
    try {
      if (items.length > 0) {
        const lines = items.map((r) => ({ item_id: r.item_id as string, qty: qtyOf(g.ym, r), expected_stock_qty: stock.get(r.item_id as string) ?? r.stock_qty ?? 0 }));
        await postReceipt({ lines, ym: g.ym }, csrf);
        for (const l of lines) stock.set(l.item_id, l.expected_stock_qty + l.qty);
        cleared(items.map((r) => idOf(g.ym, r.key)));
        saved += items.length;
      }
      for (const r of picked.filter((x) => x.item_id === null)) {
        await postCustomReceipt(g.ym, { line_key: r.key, qty: qtyOf(g.ym, r), expected_received: r.received }, csrf);
        cleared([idOf(g.ym, r.key)]);
        saved += 1;
      }
    } catch (e) {
      throw new MakeupFailed(g.ym, saved, apiErrorCode(e) ?? 'UNKNOWN');
    }
  }
  return saved;
}

export function ArrivalsMakeup({ groups, onDone }: Props) {
  const { t } = useTranslation();
  const fmt = useRequestFormat();
  const { csrfToken } = useMe();
  const flight = useSingleFlight();
  const [raw, setRaw] = useState<Record<string, string>>({});
  const [closed, setClosed] = useState<{ ym: string; key: string; name: string } | null>(null);
  const count = groups.reduce((n, g) => n + g.rows.length, 0);
  if (count === 0 && !closed) return null;
  const parsed = (ym: string, r: PlanMakeupRow) => parseQty(raw[idOf(ym, r.key)] ?? '0');
  const qtyOf = (ym: string, r: PlanMakeupRow) => parsed(ym, r).qty;
  const invalid = groups.some((g) => g.rows.some((r) => parsed(g.ym, r).error));
  const any = groups.some((g) => g.rows.some((r) => qtyOf(g.ym, r) > 0));
  const run = (task: () => Promise<number | void>) =>
    flight.run(async () => {
      try {
        const n = await task();
        await onDone(null, typeof n === 'number' ? n : undefined);
      } catch (e) {
        if (e instanceof MakeupFailed) await onDone(e.code, e.saved, e.ym);
        else await onDone(apiErrorCode(e) ?? 'UNKNOWN');
      }
    });
  const save = () =>
    run(() =>
      saveMakeup(groups, qtyOf, csrfToken, (ids) =>
        setRaw((prev) => {
          const next = { ...prev };
          for (const id of ids) delete next[id];
          return next;
        }),
      ),
    );
  const close = (ym: string, r: PlanMakeupRow) =>
    run(async () => {
      await setOwedClosed(ym, r.key, true, csrfToken);
      setClosed({ ym, key: r.key, name: fmt.name(r) });
    });
  const undo = () =>
    run(async () => {
      if (!closed) return;
      await setOwedClosed(closed.ym, closed.key, false, csrfToken);
      setClosed(null);
    });
  const cols = ['month', 'item', 'ordered', 'received', 'owed', 'qty'] as const;
  return (
    <details className="ar-card ar-fold">
      <summary>{t('arrivals.makeup.title', { n: count })}</summary>
      {closed && (
        <p role="status" className="ar-closed">
          {t('arrivals.makeup.closed', { name: closed.name, month: monthOf(closed.ym) })}
          <button type="button" className="btn btn--sm" disabled={flight.pending} onClick={() => void undo()}>
            {t('arrivals.makeup.undo')}
          </button>
        </p>
      )}
      {count > 0 && (
        <table className="ar-mini">
          <thead>
            <tr>
              {cols.map((c) => (
                <th key={c} scope="col" className={c === 'ordered' || c === 'received' || c === 'owed' ? 'n' : undefined}>
                  {t(`arrivals.makeup.${c}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {groups.flatMap((g) =>
              g.rows.map((r) => {
                const id = idOf(g.ym, r.key);
                const label = { name: fmt.name(r), month: monthOf(g.ym) };
                return (
                  <tr key={id}>
                    <td data-label={t('arrivals.makeup.month')}>{monthOf(g.ym)}</td>
                    <td>{fmt.name(r)}</td>
                    <td className="n" data-label={t('arrivals.makeup.ordered')}>{r.ordered}</td>
                    <td className="n" data-label={t('arrivals.makeup.received')}>{r.received}</td>
                    <td className="n" data-label={t('arrivals.makeup.owed')}>{r.adm_owed}</td>
                    <td className="ar-qty" data-label={t('arrivals.makeup.qty')}>
                      <div className="ar-qty__in">
                        <input type="number" inputMode="numeric" min={0} aria-label={t('arrivals.makeup.qtyLabel', label)} aria-invalid={parsed(g.ym, r).error ? true : undefined} value={raw[id] ?? '0'} onChange={(e) => setRaw((p) => ({ ...p, [id]: e.target.value }))} />
                        <button type="button" className="ar-adm" aria-label={t('arrivals.makeup.closeLabel', label)} disabled={flight.pending} onClick={() => void close(g.ym, r)}>
                          {t('arrivals.makeup.close')}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              }),
            )}
          </tbody>
        </table>
      )}
      {count > 0 && (
        <div className="ar-foot">
          <button type="button" className="btn btn--primary" disabled={invalid || !any || flight.pending} onClick={() => void save()}>
            {t('arrivals.makeup.save')}
          </button>
        </div>
      )}
    </details>
  );
}
