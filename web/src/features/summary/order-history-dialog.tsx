import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { requestStatus, requestStatusText, type RequestStatusKey } from '@/lib/request-status';
import { Dialog, DialogCloseButton, DialogTitle } from '@/ui/dialog';
import { Icon } from '@/ui/icon';
import { LoadError } from '@/ui/load-state';
import { useCurrentPeriod } from '@/features/request/request.api';
import { OrderHistoryMonth } from './order-history-month';
import { OrderHistorySummary } from './order-history-summary';
import { useUserHistory, type UserHistoryItem } from './summary.api';

const TONE: Record<RequestStatusKey, string> = { done: 'ok', partial: 'info', notDelivered: 'warn', owed: 'warn', cancelled: 'muted' };
const pad = (m: number) => String(m).padStart(2, '0');

// Năm + tab tháng (chấm trạng thái), mặc định tháng mới nhất có phiếu; không tiến quá năm của kỳ đang mở
export function OrderHistoryDialog({ sub, name, onClose }: { sub: string; name: string; onClose: () => void }) {
  const { t } = useTranslation();
  const current = useCurrentPeriod();
  const maxYear = current.data ? Number(current.data.ym.slice(0, 4)) : undefined;
  const lastMonth = current.data ? Number(current.data.ym.slice(5)) : 12;
  const [asked, setAsked] = useState<number | null>(null);
  const year = asked ?? maxYear;
  const [picked, setPicked] = useState<{ year: number; month: number } | null>(null);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} className="sheet oh" maxWidth={640}>
      <div className="sheet-header">
        <DialogTitle className="sheet-title">{t('summary.history.title', { name })}</DialogTitle>
        <DialogCloseButton />
      </div>
      <div className="sheet-body">
        {year !== undefined && (
          <YearBody
            sub={sub}
            year={year}
            months={year === maxYear ? lastMonth : 12}
            canNext={maxYear !== undefined && year < maxYear}
            month={picked?.year === year ? picked.month : undefined}
            onMonth={(month) => setPicked({ year, month })}
            onYear={(next) => setAsked(next)}
          />
        )}
      </div>
    </Dialog>
  );
}

interface BodyProps {
  sub: string;
  year: number;
  months: number;
  canNext: boolean;
  month: number | undefined;
  onMonth: (m: number) => void;
  onYear: (y: number) => void;
}

function YearBody({ sub, year, months, canNext, month, onMonth, onYear }: BodyProps) {
  const { t } = useTranslation();
  const history = useUserHistory(sub, year);
  const byMonth = new Map<number, UserHistoryItem>((history.data?.items ?? []).map((i) => [Number(i.period_ym.slice(5)), i]));
  const first = history.data?.items?.[0];
  const latest = first ? Number(first.period_ym.slice(5)) : months;
  const selected = month ?? latest;
  const list = Array.from({ length: months }, (_, i) => months - i);
  const labelOf = (m: number) => {
    const it = byMonth.get(m);
    const status = it ? requestStatusText(t, requestStatus({ qty: it.total_qty, delivered: it.delivered_qty, cancelled: it.cancelled_qty })) : t('summary.history.noOrder');
    return t('summary.history.tab', { month: m, status });
  };
  return (
    <>
      <div className="oh-year">
        <button type="button" className="btn btn--ghost btn--sm ct-icon-btn" aria-label={t('summary.history.prevYear')} onClick={() => onYear(year - 1)}>
          <Icon name="chevl" size={18} />
        </button>
        <b className="num">{year}</b>
        <button type="button" className="btn btn--ghost btn--sm ct-icon-btn" aria-label={t('summary.history.nextYear')} disabled={!canNext} onClick={() => onYear(year + 1)}>
          <Icon name="chevr" size={18} />
        </button>
      </div>
      {history.data?.summary && <OrderHistorySummary summary={history.data.summary} />}
      {history.isError ? (
        <LoadError onRetry={() => void history.refetch()} />
      ) : (
        <>
          <div className="oh-tabs" role="tablist" aria-label={t('summary.history.months', { year })}>
            {list.map((m) => {
              const it = byMonth.get(m);
              const tone = it ? TONE[requestStatus({ qty: it.total_qty, delivered: it.delivered_qty, cancelled: it.cancelled_qty }).key] : 'none';
              return (
                <button key={m} type="button" role="tab" className="oh-tab" aria-selected={m === selected} aria-label={labelOf(m)} onClick={() => onMonth(m)}>
                  <span aria-hidden="true">{t('summary.history.short', { month: m })}</span>
                  <span className="oh-dot" data-tone={tone} aria-hidden="true" />
                </button>
              );
            })}
          </div>
          <div role="tabpanel" aria-label={labelOf(selected)}>
            {history.data && <OrderHistoryMonth ym={`${year}-${pad(selected)}`} requestId={byMonth.get(selected)?.request_id} />}
          </div>
        </>
      )}
    </>
  );
}
