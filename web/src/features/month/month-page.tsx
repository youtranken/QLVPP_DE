import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { YM, lockedYm } from '@/lib/ym';
import { Loading, LoadError } from '@/ui/load-state';
import { usePeriodSummary } from '@/features/summary/summary.api';
import { useCurrentPeriod } from '@/features/request/request.api';
import { monthOf } from '@/features/request/request-format';
import { MonthLockedView } from './month-locked-view';
import { MonthOpenView } from './month-open-view';
import { PeriodSwitch } from './period-switch';
import { isAskedYm, pickDefaultYm, useMonthParams } from './use-month-params';
import '@/features/summary/summary.m1.css';
import './month.m1.css';

export function MonthPage() {
  const { t } = useTranslation();
  const current = useCurrentPeriod();
  const openYm = current.data?.ym;
  // Chỉ hỏi kỳ khóa khi URL chưa có ym hợp lệ; lỗi thì về kỳ khóa như trước
  const [params] = useSearchParams();
  const probeYm = openYm && !isAskedYm(params.get('ym'), openYm) ? lockedYm(openYm) : undefined;
  const probe = usePeriodSummary(probeYm);
  const defaultYm = !openYm ? undefined : probe.data ? pickDefaultYm(openYm, probe.data) : probe.isError ? lockedYm(openYm) : undefined;
  const p = useMonthParams(openYm, defaultYm);
  const summary = usePeriodSummary(p.ym);
  // Chưa biết kỳ (đang tải hoặc lỗi): vẫn giữ đầu trang — tiêu đề theo ?ym= nếu có, chọn kỳ chỉ hiện khi biết kỳ đang mở
  const asked = params.get('ym');
  const headYm = p.ym ?? (asked && YM.test(asked) ? asked : undefined);
  return (
    <div className="ct-page sm-page mk-page">
      <div className="mk-head">
        <h1>{headYm ? t('month.title', { month: monthOf(headYm) }) : t('nav.month')}</h1>
        {p.ym && openYm && <PeriodSwitch ym={p.ym} openYm={openYm} earliestYm={summary.data?.earliest_ym} onChange={p.setYm} />}
      </div>
      {current.isError ? (
        <LoadError onRetry={() => void current.refetch()} />
      ) : !p.ym || !openYm ? (
        <Loading />
      ) : p.ym === openYm ? (
        <MonthOpenView ym={p.ym} />
      ) : (
        <MonthLockedView ym={p.ym} openYm={openYm} chip={p.chip} q={p.q} left={p.left} presetReason={p.presetReason} onChip={p.setChip} onQ={p.setQ} />
      )}
    </div>
  );
}
