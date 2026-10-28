import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { PeriodSummary, SummaryFilter } from './summary.api';

interface KpiStripProps {
  summary: PeriodSummary;
  filter: SummaryFilter;
  onFilter: (filter: SummaryFilter) => void;
}

function Tile({ value, label, hint, tone }: { value: ReactNode; label: string; hint: string; tone?: 'warn' | 'danger' }) {
  return (
    <>
      <b className={`kpi-value num${tone ? ` is-${tone}` : ''}`}>{value}</b>
      <span className="kpi-label">{label}</span>
      <small className="kpi-hint">{hint}</small>
    </>
  );
}

// Mẫu số y = headcount server trả (snapshot nếu đã chụp); số chưa đăng ký lấy `unregistered`, không lấy y − x
export function KpiStrip({ summary, filter, onFilter }: KpiStripProps) {
  const { t } = useTranslation();
  const source = t(summary.headcount_source === 'snapshot' ? 'summary.kpi.headcountSnapshot' : 'summary.kpi.headcountLive');
  return (
    <section className="kpi-strip" aria-label={t('summary.kpi.label')}>
      <button type="button" className="kpi" aria-pressed={filter === 'all'} onClick={() => onFilter('all')}>
        <Tile
          value={`${summary.registered}/${summary.headcount}`}
          label={t('summary.kpi.registered')}
          hint={`${source} · ${t('summary.kpi.unregistered', { n: summary.unregistered })}`}
        />
      </button>
      <button
        type="button"
        className="kpi"
        aria-pressed={filter === 'pending_delivery'}
        onClick={() => onFilter('pending_delivery')}
      >
        <Tile
          value={summary.lines_pending_delivery}
          label={t('summary.kpi.pendingDelivery')}
          hint={t('summary.kpi.pendingDeliveryHint')}
        />
      </button>
      <Link className="kpi" to="/admin/review">
        <Tile
          value={summary.custom_pending}
          label={t('summary.kpi.customPending')}
          hint={t('summary.kpi.customPendingHint')}
          tone={summary.custom_pending > 0 ? 'warn' : undefined}
        />
      </Link>
      <Link className="kpi" to="/admin/stock?filter=low">
        <Tile
          value={summary.low_stock}
          label={t('summary.kpi.lowStock')}
          hint={t('summary.kpi.lowStockHint')}
          tone={summary.low_stock > 0 ? 'danger' : undefined}
        />
      </Link>
    </section>
  );
}
