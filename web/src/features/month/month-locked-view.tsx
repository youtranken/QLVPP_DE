import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { usePanelParam } from '@/lib/use-panel-param';
import { lockedYm } from '@/lib/ym';
import { LoadError, Loading } from '@/ui/load-state';
import { arrivalsPlanQuery } from '@/features/arrivals/arrivals.api';
import { useSendState } from '@/features/send-adm/use-send-state';
import { AdjustDialog } from '@/features/summary/adjust-dialog';
import { OrderHistoryDialog } from '@/features/summary/order-history-dialog';
import { RegistrationDialog } from '@/features/summary/registration-dialog';
import { usePeriodSummary, type AdjustReason, type PersonRow } from '@/features/summary/summary.api';
import { usePersonTableRows } from '@/features/summary/use-person-table-rows';
import { isLeftOwing, matchesChip, type MonthChip } from './month-chips';
import { MonthFilters } from './month-filters';
import { keepViewing } from './keep-viewing';
import { MonthLeftReminder } from './month-left-reminder';
import { MonthPeopleTable } from './month-people-table';
import { MonthStrip } from './month-strip';
import { MonthItemsTable } from './month-items-table';
import type { MonthView } from './use-month-params';
import { monthSteps } from './month-steps';

interface Props {
  switcher: ReactNode;
  ym: string;
  openYm: string;
  chip: MonthChip;
  view: MonthView;
  areas: readonly string[];
  q: string;
  left: boolean;
  presetReason: AdjustReason | undefined;
  onChip: (c: MonthChip) => void;
  onLeft: (on: boolean) => void;
  onView: (v: MonthView) => void;
  onAreas: (a: readonly string[]) => void;
  onQ: (q: string) => void;
}

// Kỳ khóa: dải 4 bước, nhắc người đã nghỉ (chỉ kỳ khóa gần nhất), bảng người.
// Kỳ cũ vẫn tính đủ 4 bước từ dữ liệu thật (send-state, arrivals-plan nhận mọi kỳ đã khóa): "—" đọc như chưa làm gì
export function MonthLockedView({ switcher, ym, openYm, chip, view, areas, q, left, presetReason, onChip, onLeft, onView, onAreas, onQ }: Props) {
  const { t } = useTranslation();
  const latest = ym === lockedYm(openYm);
  const summary = usePeriodSummary(ym);
  const all = usePersonTableRows(ym, '');
  const filtered = usePersonTableRows(q ? ym : undefined, q);
  const send = useSendState(ym);
  const plan = useQuery(arrivalsPlanQuery(ym));
  const [viewing, setViewing] = useState<string | null>(null);
  const shown = q ? filtered : all;
  const noDept = t('month.table.noDepartment');
  const areaOf = useCallback((r: PersonRow) => r.department ?? noDept, [noDept]);
  const areaOptions = useMemo(() => [...new Set(all.rows.map(areaOf))].sort((a, b) => a.localeCompare(b, 'vi')), [all.rows, areaOf]);
  const inAreas = useCallback((r: PersonRow) => areas.length === 0 || areas.includes(areaOf(r)), [areas, areaOf]);
  const visible = useMemo(() => shown.rows.filter((r) => matchesChip(r, chip) && (!left || isLeftOwing(r)) && inAreas(r)), [shown.rows, chip, left, inAreas]);
  const open = useCallback((r: PersonRow) => setViewing(r.request_id), []);
  const [history, setHistory] = useState<PersonRow | null>(null);
  const panel = usePanelParam('request', { order: useMemo(() => visible.map((r) => r.request_id), [visible]) });
  const viewRows = useMemo(() => keepViewing(visible, shown.rows, viewing), [visible, shown.rows, viewing]);
  const clear = () => {
    onChip('all');
    onQ('');
    onAreas([]);
    onLeft(false);
  };
  // Chưa nạp hết người của tháng này (đang tải hoặc còn trang sau): bước Giao, chip và "Đang hiện" chưa có số đúng
  const partial = (x: typeof all) => x.query.isPending || x.query.hasNextPage;
  const filters = (
    <MonthFilters
      switcher={switcher}
      view={view}
      onView={onView}
      rows={shown.rows}
      loading={partial(shown) || partial(all)}
      chip={chip}
      q={q}
      left={left}
      areas={areas}
      areaOptions={areaOptions}
      shown={visible.length}
      total={all.rows.length}
      onChip={onChip}
      onQ={onQ}
      onLeft={onLeft}
      onAreas={onAreas}
      onClear={clear}
    />
  );

  const failed = [summary, all.query, send.query, plan].find((x) => 'isError' in x && x.isError);
  const ready = !failed && summary.data && send.query.data && plan.data;
  const people = all.rows.filter((r) => r.total_qty > 0);
  const steps =
    ready &&
    monthSteps(
      {
        registered: summary.data!.registered,
        headcount: summary.data!.headcount,
        isOpen: false,
        send: send.state ? { state: send.state, at: send.sent?.created_at ?? send.noOrder?.at ?? null } : null,
        plan: plan.data ?? null,
        deliver: partial(all) ? 'loading' : { done: people.filter((r) => r.delivered_qty + r.cancelled_qty >= r.total_qty).length, total: people.length },
      },
      t,
    );
  const index = viewRows.findIndex((r) => r.request_id === viewing);
  // Thứ tự con cố định (dải, băng, thanh công cụ, thân): đang tải hay xong, bộ chọn kỳ không bị dựng lại nên giữ focus
  return (
    <>
      {steps && <MonthStrip steps={steps} />}
      {ready && latest && !partial(all) && <MonthLeftReminder count={all.rows.filter(isLeftOwing).length} onFilter={() => onLeft(true)} />}
      {filters}
      {failed ? (
        <LoadError onRetry={() => void failed.refetch()} />
      ) : !ready ? (
        <Loading />
      ) : view === 'items' ? (
        <MonthItemsTable ym={ym} />
      ) : shown.query.isError ? (
        <LoadError onRetry={() => void shown.query.refetch()} />
      ) : (
        <MonthPeopleTable
          rows={visible}
          loading={shown.query.isPending}
          busy={shown.query.isPlaceholderData}
          narrowed={Boolean(q) || chip !== 'all' || left || areas.length > 0}
          activeId={panel.id ?? undefined}
          onView={open}
          onAdjust={panel.open}
          onHistory={setHistory}
          onClear={clear}
        />
      )}
      {index >= 0 && <RegistrationDialog ym={ym} deadline={null} rows={viewRows} index={index} onIndex={(i) => setViewing(viewRows[i]!.request_id)} onClose={() => setViewing(null)} />}
      {history && <OrderHistoryDialog sub={history.user_sub} name={history.full_name ?? history.email ?? history.user_sub} onClose={() => setHistory(null)} />}
      {panel.id && <AdjustDialog key={panel.id} requestId={panel.id} presetReason={presetReason} onClose={panel.close} nav={{ index: panel.index, total: panel.total, onStep: panel.step }} />}
    </>
  );
}
