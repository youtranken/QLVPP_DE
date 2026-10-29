import { useTranslation } from 'react-i18next';

// total = phần hiệu lực trừ phần đã hủy nợ: phiếu giao 3 + hủy 2 trên 5 là đã đủ
export function DeliveryBar({ done, total }: { done: number; total: number }) {
  const { t } = useTranslation();
  // Phiếu chỉ còn dòng chờ xem/bị từ chối: không có gì để giao
  if (total === 0) return <span className="muted">—</span>;
  const pct = Math.round((done / total) * 100);
  return (
    <span className="sm-delivery">
      <span
        className="sm-bar"
        role="progressbar"
        aria-label={t('summary.person.delivered', { done, total })}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
      >
        <i style={{ width: `${pct}%` }} />
      </span>
      <span className="num">
        {done}/{total}
      </span>
    </span>
  );
}
