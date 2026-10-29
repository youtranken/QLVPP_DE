import { useId, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { YM, shiftYm } from '@/lib/ym';
import { EmptyState, Loading, LoadError } from '@/ui/load-state';
import { MonthSwitcher } from '@/ui/month-switcher';
import { useCurrentPeriod } from '@/features/request/request.api';
import { monthOf } from '@/features/request/request-format';
import { DeliveryBar } from '@/features/summary/delivery-bar';
import { useAdminRequest, usePersonRows, type PersonRow } from '@/features/summary/summary.api';
import { isDeliverable } from './delivery.api';
import { DeliveryRequest } from './delivery-request';
import '@/features/admin/admin.css';
import '@/features/summary/summary.css';
import './delivery.css';

// Phiếu đang mở mà vừa giao đủ thì rời bộ lọc "còn cần giao": giữ lại hàng để Hành chính thấy kết quả
function useStickyRows(rows: PersonRow[], opened: Set<string>): PersonRow[] {
  const seen = useRef(new Map<string, PersonRow>());
  for (const r of rows) seen.current.set(r.request_id, r);
  const ids = new Set(rows.map((r) => r.request_id));
  const kept = [...opened].filter((id) => !ids.has(id)).flatMap((id) => seen.current.get(id) ?? []);
  return [...rows, ...kept];
}

function RequestRow({ row, open, onToggle }: { row: PersonRow; open: boolean; onToggle: () => void }) {
  const { t } = useTranslation();
  const panelId = useId();
  const view = useAdminRequest(row.request_id, open).data;
  const name = row.full_name ?? row.email ?? row.user_sub;
  const effective = view?.lines.filter(isDeliverable);
  const done = effective ? effective.reduce((s, l) => s + l.delivered_qty, 0) : row.delivered_qty;
  const total = effective ? effective.reduce((s, l) => s + l.qty - l.cancelled_qty, 0) : row.total_qty - row.cancelled_qty;
  return (
    <li className={open ? 'dl-item is-open' : 'dl-item'}>
      <div className="dl-head">
        <button type="button" className="dl-toggle" aria-expanded={open} aria-controls={open ? panelId : undefined} onClick={onToggle}>
          <span className="dl-chev" aria-hidden="true">
            ›
          </span>
          <span className="dl-who">
            <b>{name}</b>
            <small>{row.department ?? t('delivery.noDepartment')}</small>
          </span>
        </button>
        <DeliveryBar done={done} total={total} />
      </div>
      {open && (
        <div id={panelId} className="dl-panel">
          <DeliveryRequest requestId={row.request_id} name={name} />
        </div>
      )}
    </li>
  );
}

function RequestList({ ym, showAll, initialOpen }: { ym: string; showAll: boolean; initialOpen: string | null }) {
  const { t } = useTranslation();
  const query = usePersonRows(ym, showAll ? 'all' : 'pending_delivery', '');
  const [opened, setOpened] = useState(() => new Set(initialOpen ? [initialOpen] : []));
  const rows = useStickyRows(query.data?.pages.flatMap((p) => p.items) ?? [], opened);
  const toggle = (id: string) =>
    setOpened((s) => {
      const next = new Set(s);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  if (query.isError) return <LoadError onRetry={() => void query.refetch()} />;
  if (query.isPending) return <Loading />;
  if (rows.length === 0) return <EmptyState title={t(showAll ? 'delivery.emptyAll' : 'delivery.empty')} />;
  return (
    <>
      <ul className="dl-list" aria-label={t('delivery.requests')} aria-busy={query.isPlaceholderData}>
        {rows.map((r) => (
          <RequestRow key={r.request_id} row={r} open={opened.has(r.request_id)} onToggle={() => toggle(r.request_id)} />
        ))}
      </ul>
      {query.hasNextPage && (
        <button type="button" className="btn admin-more sm-more" disabled={query.isFetchingNextPage} onClick={() => void query.fetchNextPage()}>
          {t('delivery.more')}
        </button>
      )}
    </>
  );
}

// Chỉ kỳ đã khóa mới giao được: mặc định và trần là tháng ngay trước kỳ đang mở
export function DeliveryPage() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const current = useCurrentPeriod();
  const [showAll, setShowAll] = useState(false);
  const maxYm = current.data ? shiftYm(current.data.ym, -1) : undefined;
  const asked = params.get('ym');
  const ym = asked && maxYm && YM.test(asked) && asked <= maxYm ? asked : maxYm;

  if (current.isError) return <LoadError onRetry={() => void current.refetch()} />;
  if (!ym || !maxYm) return <Loading />;
  return (
    <div className="a-stack">
      <div className="a-toolbar dl-tools">
        <MonthSwitcher
          value={ym}
          max={maxYm}
          onChange={(v) => setParams({ ym: v })}
          formatLabel={(v) => t('delivery.month', { month: monthOf(v), year: v.slice(0, 4) })}
          labels={{ group: t('delivery.monthNav'), prev: t('delivery.prevMonth'), next: t('delivery.nextMonth') }}
        />
        <span className="sp" />
        <label className="dl-switch">
          <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} />
          {t('delivery.showAll')}
        </label>
      </div>
      <section className="a-panel">
        <RequestList key={ym} ym={ym} showAll={showAll} initialOpen={params.get('request')} />
      </section>
    </div>
  );
}
