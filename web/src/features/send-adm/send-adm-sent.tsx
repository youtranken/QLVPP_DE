import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { formatVnStamp } from '@/lib/format-time';
import { activeNeed } from '@/lib/report-qty';
import { Icon } from '@/ui/icon';
import { PageHeader } from '@/ui/page-header';
import type { AdminItem } from '@/features/catalog/catalog.api';
import { printPath, type MonthReport, type SnapshotData } from '@/features/reports/reports.api';
import { ReportSnapshots } from '@/features/reports/report-snapshots';
import type { SnapshotDownload } from '@/features/reports/use-snapshot';
import { useNewDraftConfirm } from './use-send-adm-confirms';
import { ItemCell } from './send-adm-orders';
import { useRegistrants } from './use-registrants';
import { basisNeedOf, carryFromSent, sentOrderOf, toOrderRows } from './send-adm-rows';
import type { SendState } from './use-send-state';
import type { SentSnapshot } from './send-adm.api';

interface Props {
  head: { crumbs: string[]; title: string; description: string };
  report: MonthReport;
  items: AdminItem[];
  send: SendState & { sent: SentSnapshot };
  files: SnapshotDownload;
  onNewDraft: (carry: Record<string, number>) => void;
}

// Cần nay khác cần lúc chốt: so số đã gửi (kể cả số sửa tay) với cần nay
function W7({ sent, now }: { sent: number; now: number }) {
  const { t } = useTranslation();
  if (sent === now) return null;
  const surplus = sent > now;
  return (
    <span role="status" className="diff-note" data-tone={surplus ? 'surplus' : 'short'}>
      {t(surplus ? 'warn.W7surplus' : 'warn.W7short', { x: sent, y: now, n: Math.abs(sent - now) })}
    </span>
  );
}

// Cần nay cộng lại phần đã giao sau bản: giao hàng không làm lệch so với cần lúc chốt
function SentTable({ data, report, items, delivered }: { data: SnapshotData; report: MonthReport; items: AdminItem[]; delivered: Record<string, number> }) {
  const { t } = useTranslation();
  const rows = useMemo(() => toOrderRows(data, items), [data, items]);
  const people = useRegistrants(report.ym);
  const live = useMemo(() => new Map([...report.byItem, ...report.custom].map((r) => [r.key, activeNeed(r) + (delivered[r.key] ?? 0)])), [report, delivered]);
  const source = new Map([...data.byItem, ...data.custom].map((r) => [r.key, r]));
  const n = (v: number) => v.toLocaleString('vi-VN');
  return (
    <section className="sa-card" aria-labelledby="sa-sent-title">
      <h2 id="sa-sent-title">{t('sendAdm.orders.title')}</h2>
      <table className="sa-orders" aria-label={t('sendAdm.sent.label')}>
        <thead>
          <tr>
            <th scope="col">{t('sendAdm.orders.item')}</th>
            <th scope="col" className="n">{t('sendAdm.orders.need')}</th>
            <th scope="col" className="n">{t('sendAdm.orders.stock')}</th>
            <th scope="col" className="n">{t('sendAdm.orders.qty')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const src = source.get(r.key)!;
            const qty = sentOrderOf(data, src);
            const now = live.get(r.key) ?? delivered[r.key] ?? 0;
            return (
              <tr key={r.key}>
                <ItemCell row={r} who={{ ym: report.ym, people: people.get(r.key) }} />
                <td className="n" data-label={t('sendAdm.orders.need')}>{n(r.want)}</td>
                <td className="n" data-label={t('sendAdm.orders.stock')}>{r.stock === null ? '—' : n(r.stock)}</td>
                <td className="n sa-qty" data-label={t('sendAdm.orders.qty')}>
                  <b className="sa-order__n">{n(qty)}</b>
                  {now !== basisNeedOf(data, src) && <W7 sent={qty} now={now} />}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

export function SendAdmSent({ head, report, items, send, files, onNewDraft }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const confirmNew = useNewDraftConfirm();
  const { sent } = send;
  const time = formatVnStamp(sent.created_at);
  const banner = [t('sendAdm.sent.banner', { time, x: sent.items_count, y: sent.units_total }), sent.replaces ? t('sendAdm.sent.replaces', { time: formatVnStamp(sent.replaces.created_at) }) : null].filter(Boolean).join(' ');
  const newDraft = async () => {
    if (await confirmNew(sent.created_at)) onNewDraft(carryFromSent(sent.data));
  };
  return (
    <div className="ct-page sa-page">
      <PageHeader
        {...head}
        secondary={
          <button type="button" className="btn" disabled={files.pending} onClick={() => files.run(sent.id)}>
            <Icon name="sheet" size={18} />
            {t('sendAdm.sent.excel')}
          </button>
        }
        primary={
          <button type="button" className="btn btn--primary" onClick={() => navigate(`${printPath(sent.id)}?from=send-adm`)}>
            <Icon name="printer" size={18} />
            {t('sendAdm.sent.reprint')}
          </button>
        }
      />
      <p className="alert alert--ok sa-banner">{banner}</p>
      {send.changedAfter && <p className="alert alert--warn">{t('warn.W6banner', { time })}</p>}
      <div className="sa-row">
        <button type="button" className="btn btn--ghost" onClick={() => void newDraft()}>
          {t('sendAdm.sent.newDraft')}
        </button>
      </div>
      <SentTable data={sent.data} report={report} items={items} delivered={send.deliveredSince} />
      <ReportSnapshots ym={report.ym} files={files} />
    </div>
  );
}
