import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FilterNotice } from '@/ui/filter-notice';
import { LoadError } from '@/ui/load-state';
import { PageHeader } from '@/ui/page-header';
import { Segmented } from '@/ui/segmented';
import { useBacklog, type BacklogBy } from './backlog.api';
import { BacklogStats } from './backlog-stats';
import { BacklogTable, type LineAction } from './backlog-table';
import { applyFilter, backlogStats, flatten, type BacklogRow } from './backlog-rows';
import { CancelDialog } from './cancel-dialog';
import { DeliverMoreDialog } from './deliver-more-dialog';
import { DeliveriesDrawer } from './deliveries-drawer';
import { useRefreshAfterDelivery } from './delivery.api';
import { useBacklogParams } from './use-backlog-params';
import '@/features/admin/admin.css';
import './backlog.m1.css';

// Dòng đang thao tác lấy theo dữ liệu mới nhất; dòng hết nợ (rời danh sách) giữ bản lúc mở để hộp thoại không vỡ
function useOpenLine(rows: BacklogRow[]) {
  const [open, setOpen] = useState<{ action: LineAction; line: BacklogRow } | null>(null);
  const line = open ? (rows.find((r) => r.id === open.line.id) ?? open.line) : null;
  return {
    action: open?.action,
    line,
    start: (action: LineAction, row: BacklogRow) => setOpen({ action, line: row }),
    close: () => setOpen(null),
  };
}

export function BacklogPage() {
  const { t } = useTranslation();
  const p = useBacklogParams();
  const query = useBacklog(p.by);
  const refresh = useRefreshAfterDelivery();
  const all = useMemo(() => flatten(query.data?.groups ?? []), [query.data]);
  const rows = useMemo(() => applyFilter(all, p.filter), [all, p.filter]);
  const open = useOpenLine(all);
  const title = t('delivery.backlog.title');
  const reload = () => open.line && void refresh(open.line.request_id);
  const done = async () => {
    if (open.line) await refresh(open.line.request_id);
    open.close();
  };
  const views = [
    { value: 'item' as BacklogBy, label: t('delivery.backlog.byItem') },
    { value: 'person' as BacklogBy, label: t('delivery.backlog.byPerson') },
  ];

  return (
    <div className="bl-page">
      <PageHeader
        crumbs={[t('nav.groups.monthly'), title]}
        title={title}
        description={t('delivery.backlog.description')}
        actions={<Segmented label={t('delivery.backlog.by')} value={p.by} options={views} onChange={p.setBy} />}
      />
      {query.isError && <LoadError onRetry={() => void query.refetch()} />}
      {query.isSuccess && <BacklogStats stats={backlogStats(all)} filter={p.filter} onFilter={p.toggleFilter} />}
      {p.filter && <FilterNotice label={t(`delivery.backlog.filters.${p.filter}`)} count={rows.length} onClear={p.clearFilter} />}
      {!query.isError && <BacklogTable rows={rows} by={p.by} loading={query.isPending} filtered={p.filter !== null} onAction={open.start} />}
      {open.line && open.action === 'deliver' && <DeliverMoreDialog line={open.line} onDone={done} onStale={reload} onClose={open.close} />}
      {open.line && open.action === 'cancel' && <CancelDialog line={open.line} onDone={done} onStale={reload} onClose={open.close} />}
      {open.line && open.action === 'history' && <DeliveriesDrawer line={open.line} onClose={open.close} />}
    </div>
  );
}
