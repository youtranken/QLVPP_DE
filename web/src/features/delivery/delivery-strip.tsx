import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { vnLockDate } from '@/lib/format-time';
import { Icon } from '@/ui/icon';
import { monthOf } from '@/features/request/request-format';
import { pickName, useMonthReport } from '@/features/reports/reports.api';
import { usePeriodSummary } from '@/features/summary/summary.api';

const SHOWN_NAMES = 3;

// "Thiếu kho" lấy số server tính (need > 0 của Báo cáo, BR-15), không tự tính ở FE (D5)
export function DeliveryStrip({ ym, pendingCount }: { ym: string; pendingCount?: number }) {
  const { t, i18n } = useTranslation();
  const summary = usePeriodSummary(ym).data;
  const report = useMonthReport(ym).data;
  const month = monthOf(ym);
  const short = (report?.byItem ?? []).filter((r) => r.need > 0);
  const names = short.slice(0, SHOWN_NAMES).map((r) => pickName(i18n.language, r.name, r.name_en));
  const locked = t('delivery.page.lockedBadge', { month, year: ym.slice(0, 4) });
  return (
    <section className="dv-strip" aria-label={t('delivery.page.strip', { month })}>
      <span className="tag tag--dark dv-strip__lock">
        <Icon name="lock" size={14} />
        {summary?.deadline ? `${locked} · ${t('delivery.page.lockedAt', { date: vnLockDate(summary.deadline) })}` : locked}
      </span>
      {summary && pendingCount !== undefined && (
        <span className="dv-strip__item num">
          {t('delivery.page.full', { full: Math.max(0, summary.registered - pendingCount), total: summary.registered })}
        </span>
      )}
      {short.length > 0 && (
        <span className="dv-strip__item dv-strip__short">
          <span>{t('delivery.page.short', { n: short.length, names: `${names.join(', ')}${short.length > SHOWN_NAMES ? '…' : ''}` })}</span>
          <Link to="/admin/stock">{t('delivery.page.toStock')}</Link>
        </span>
      )}
    </section>
  );
}
