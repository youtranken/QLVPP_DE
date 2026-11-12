import { useCallback, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { usePanelParam } from '@/lib/use-panel-param';
import { lockedYm } from '@/lib/ym';
import { LoadError, Loading } from '@/ui/load-state';
import { arrivalsPlanQuery } from '@/features/arrivals/arrivals.api';
import { useSendState } from '@/features/send-adm/use-send-state';
import { AdjustDrawer } from '@/features/summary/adjust-drawer';
import { RegistrationDialog } from '@/features/summary/registration-dialog';
import { usePeriodSummary, type AdjustReason, type PersonRow } from '@/features/summary/summary.api';
import { usePersonTableRows } from '@/features/summary/use-person-table-rows';
import { MonthChips } from './month-chips-bar';
import { matchesChip, type MonthChip } from './month-chips';
import { MonthLeftReminder } from './month-left-reminder';
import { MonthPeopleTable } from './month-people-table';
import { MonthStrip } from './month-strip';
import { monthSteps } from './month-steps';

interface Props {
  ym: string;
  openYm: string;
  chip: MonthChip;
  q: string;
  left: boolean;
  presetReason: AdjustReason | undefined;
  onChip: (c: MonthChip) => void;
  onQ: (q: string) => void;
}

// Kỳ khóa: dải 4 bước, nhắc người đã nghỉ (chỉ kỳ khóa gần nhất), bảng người.
// Kỳ cũ vẫn tính đủ 4 bước từ dữ liệu thật (send-state, arrivals-plan nhận mọi kỳ đã khóa): "—" đọc như chưa làm gì
export function MonthLockedView({ ym, openYm, chip, q, left, presetReason, onChip, onQ }: Props) {
  const { t } = useTranslation();
  const latest = ym === lockedYm(openYm);
  const summary = usePeriodSummary(ym);
  const all = usePersonTableRows(ym, '');
  const filtered = usePersonTableRows(q ? ym : undefined, q);
  const send = useSendState(ym);
  const plan = useQuery(arrivalsPlanQuery(ym));
  const [viewing, setViewing] = useState<string | null>(null);
  const shown = q ? filtered : all;
  // ?left=1: chỉ người đã nghỉ (còn phần chưa nhận ở chip "Chưa giao xong")
  const visible = useMemo(() => shown.rows.filter((r) => matchesChip(r, chip) && (!left || r.user_status !== 'active')), [shown.rows, chip, left]);
  const open = useCallback((r: PersonRow) => setViewing(r.request_id), []);
  const panel = usePanelParam('request', { order: useMemo(() => visible.map((r) => r.request_id), [visible]) });

  const failed = [summary, all.query, send.query, plan].find((x) => 'isError' in x && x.isError);
  if (failed) return <LoadError onRetry={() => void failed.refetch()} />;
  if (!summary.data || !send.query.data || !plan.data) return <Loading />;

  const people = all.rows.filter((r) => r.total_qty > 0);
  const steps = monthSteps(
    {
      registered: summary.data.registered,
      headcount: summary.data.headcount,
      isOpen: false,
      send: send.state ? { state: send.state, at: send.sent?.created_at ?? send.noOrder?.at ?? null } : null,
      plan: plan.data ?? null,
      deliver: { done: people.filter((r) => r.delivered_qty + r.cancelled_qty >= r.total_qty).length, total: people.length },
      ym,
    },
    t,
  );
  const index = visible.findIndex((r) => r.request_id === viewing);
  return (
    <>
      <MonthStrip steps={steps} />
      {latest && <MonthLeftReminder ym={ym} />}
      <MonthChips rows={shown.rows} chip={chip} q={q} onChip={onChip} onQ={onQ} />
      {shown.query.isError ? (
        <LoadError onRetry={() => void shown.query.refetch()} />
      ) : (
        <MonthPeopleTable
          rows={visible}
          loading={shown.query.isPending}
          busy={shown.query.isPlaceholderData}
          narrowed={Boolean(q) || chip !== 'all' || left}
          activeId={panel.id ?? undefined}
          onView={open}
          onAdjust={panel.open}
        />
      )}
      {index >= 0 && <RegistrationDialog ym={ym} deadline={null} rows={visible} index={index} onIndex={(i) => setViewing(visible[i]!.request_id)} onClose={() => setViewing(null)} />}
      {panel.id && <AdjustDrawer requestId={panel.id} presetReason={presetReason} onClose={panel.close} nav={{ index: panel.index, total: panel.total, onStep: panel.step }} />}
    </>
  );
}
