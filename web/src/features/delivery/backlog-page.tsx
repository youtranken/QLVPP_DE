import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SearchBox } from '@/ui/filter/search-box';
import { EmptyState, Loading, LoadError } from '@/ui/load-state';
import { PageHeader } from '@/ui/page-header';
import { Select } from '@/ui/select';
import { Switch } from '@/ui/switch';
import { usePanelParam } from '@/lib/use-panel-param';
import { lockedYm } from '@/lib/ym';
import { useCurrentPeriod } from '@/features/request/request.api';
import { useBacklog, type BacklogLine } from './backlog.api';
import { BacklogMonthTable, type LineAction } from './backlog-month-table';
import { useBacklogFormat } from './backlog-format';
import { backlogMonths, leftPeople, monthsOf } from './backlog-months';
import { CancelDialog } from './cancel-dialog';
import { DeliverMoreDialog } from './deliver-more-dialog';
import { DeliveriesDrawer } from './deliveries-drawer';
import { useRefreshAfterLineChange } from './people/use-refresh-after-flow';
import { useBacklogParams } from './use-backlog-params';
import './backlog.m1.css';

// Dòng đang thao tác lấy theo dữ liệu mới nhất; dòng hết nợ (rời danh sách) giữ bản lúc mở để hộp thoại không vỡ
function useOpenLine(lines: BacklogLine[]) {
  const [open, setOpen] = useState<{ action: LineAction; line: BacklogLine } | null>(null);
  const line = open ? (lines.find((l) => l.line_id === open.line.line_id) ?? open.line) : null;
  return {
    action: open?.action,
    line,
    start: (action: LineAction, row: BacklogLine) => setOpen({ action, line: row }),
    close: () => setOpen(null),
  };
}

const ALL = 'all';

export function BacklogPage() {
  const { t } = useTranslation();
  const f = useBacklogFormat();
  const p = useBacklogParams();
  const query = useBacklog('person');
  const refresh = useRefreshAfterLineChange([['admin-request']]);
  const groups = query.data?.groups;
  const available = useMemo(() => monthsOf(groups ?? []), [groups]);
  // ?ym= trỏ tới tháng không còn nợ: nhảy sang tháng đầu còn nợ (hoặc bỏ lọc khi hết nợ)
  const { ym: askedYm, setYm } = p;
  const stale = query.isSuccess && askedYm !== null && !available.includes(askedYm);
  useEffect(() => {
    if (stale) setYm(available[0] ?? null);
  }, [stale, available, setYm]);
  const ymNow = stale ? (available[0] ?? null) : askedYm;
  const all = useMemo(() => (groups ?? []).flatMap((g) => g.lines), [groups]);
  const months = useMemo(() => backlogMonths(groups ?? [], { ym: ymNow, q: p.q, left: p.left }), [groups, ymNow, p.q, p.left]);
  const visible = useMemo(() => months.flatMap((m) => m.people.flatMap((x) => x.lines)), [months]);
  const open = useOpenLine(all);
  const order = useMemo(() => visible.map((l) => l.line_id), [visible]);
  // Dòng hết nợ rời danh sách: tham số trỏ tới dòng không còn → gỡ, không mở panel
  const panel = usePanelParam('line', { order, known: (id) => (query.isSuccess ? all.some((l) => l.line_id === id) : undefined) });
  const historyLine = panel.id ? all.find((l) => l.line_id === panel.id) : undefined;
  const onAction = (action: LineAction, line: BacklogLine) => (action === 'history' ? panel.open(line.line_id) : open.start(action, line));
  const title = t('delivery.backlog.title');
  const current = useCurrentPeriod();
  const sentYm = current.data?.ym ? lockedYm(current.data.ym) : undefined;
  const reload = () => open.line && void refresh();
  const done = async () => {
    if (open.line) await refresh();
    open.close();
  };
  const monthOptions = [{ value: ALL, label: t('delivery.backlog.allMonths') }, ...available.map((ym) => ({ value: ym, label: f.month(ym) }))];
  const narrowed = ymNow !== null || p.q.trim() !== '' || p.left;

  return (
    <div className="ct-page">
      <PageHeader crumbs={[t('nav.groups.monthly'), title]} title={title} />
      {query.isError && <LoadError onRetry={() => void query.refetch()} />}
      {query.isSuccess && (
        <div className="toolbar bl-bar">
          <Select label={t('delivery.backlog.month')} hideLabel value={ymNow ?? ALL} options={monthOptions} onChange={(v) => p.setYm(v === ALL ? null : v)} />
          <SearchBox className="flt-search" label={t('delivery.backlog.search')} placeholder={t('delivery.backlog.search')} value={p.q} onChange={p.setQ} />
          <Switch checked={p.left} text={t('delivery.backlog.leftOnly', { n: leftPeople(groups ?? []) })} onChange={p.toggleLeft} />
        </div>
      )}
      {query.isPending && <Loading />}
      {query.isSuccess &&
        (months.length === 0 ? (
          <EmptyState
            title={t(narrowed ? 'delivery.backlog.noMatch' : 'delivery.backlog.empty')}
            art={narrowed ? 'no-match' : 'no-backlog'}
            hint={narrowed ? undefined : t('delivery.backlog.emptyHint')}
          />
        ) : (
          <div className="ct-block">
            <BacklogMonthTable months={months} onAction={onAction} />
          </div>
        ))}
      {open.line && open.action === 'deliver' && <DeliverMoreDialog line={open.line} onDone={done} onStale={reload} onClose={open.close} />}
      {open.line && open.action === 'cancel' && (
        <CancelDialog line={open.line} sentYm={sentYm} initialReason={p.cancelReason} onDone={done} onStale={reload} onClose={open.close} />
      )}
      {historyLine && <DeliveriesDrawer line={historyLine} onClose={panel.close} nav={{ index: panel.index, total: panel.total, onStep: panel.step }} />}
    </div>
  );
}
