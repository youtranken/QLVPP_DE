import { useTranslation } from 'react-i18next';

// Thanh tiến độ giao của một dòng: đã giao / đã đặt (số hủy nằm ngoài thanh, hiện chữ riêng)
export function LineProgress({ delivered, qty }: { delivered: number; qty: number }) {
  const { t } = useTranslation();
  const pct = qty > 0 ? Math.min(100, Math.round((delivered / qty) * 100)) : 0;
  return (
    <div
      className="hs-progress"
      role="progressbar"
      aria-label={t('request.history.progress', { delivered, qty })}
      aria-valuemin={0}
      aria-valuemax={qty}
      aria-valuenow={delivered}
    >
      <span className="hs-bar" aria-hidden="true">
        <i style={{ width: `${pct}%` }} />
      </span>
      <span className="hs-count num" aria-hidden="true">
        {delivered}/{qty}
      </span>
    </div>
  );
}
