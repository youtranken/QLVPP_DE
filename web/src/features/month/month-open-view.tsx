import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LoadError, Loading } from '@/ui/load-state';
import { RegistrationDialog, type RegistrationTarget } from '@/features/summary/registration-dialog';
import { usePeriodSummary } from '@/features/summary/summary.api';
import { MonthOpenTable } from './month-open-table';
import { MonthStrip } from './month-strip';
import { MonthUnregisteredCopy } from './month-unregistered-copy';
import { monthSteps } from './month-steps';

// Kỳ đang đăng ký: chỉ xem, chỉ bước Đăng ký có số
export function MonthOpenView({ ym }: { ym: string }) {
  const { t } = useTranslation();
  const summary = usePeriodSummary(ym);
  const [viewing, setViewing] = useState<{ id: string; rows: RegistrationTarget[] } | null>(null);
  const onView = useCallback((row: RegistrationTarget, rows: RegistrationTarget[]) => setViewing({ id: row.request_id, rows }), []);
  if (summary.isError) return <LoadError onRetry={() => void summary.refetch()} />;
  if (!summary.data) return <Loading />;
  const steps = monthSteps({ registered: summary.data.registered, headcount: summary.data.headcount, isOpen: true, send: null, plan: null, deliver: null, ym }, t);
  const index = viewing ? viewing.rows.findIndex((r) => r.request_id === viewing.id) : -1;
  return (
    <>
      <MonthStrip steps={steps} onlyFirst />
      <MonthUnregisteredCopy ym={ym} />
      <MonthOpenTable ym={ym} onView={onView} />
      {viewing && index >= 0 && (
        <RegistrationDialog
          ym={ym}
          deadline={summary.data.deadline}
          rows={viewing.rows}
          index={index}
          onIndex={(i) => setViewing({ ...viewing, id: viewing.rows[i]!.request_id })}
          onClose={() => setViewing(null)}
        />
      )}
    </>
  );
}
