import { useTranslation } from 'react-i18next';

// Thanh trên mẫu qty − cancelled; hủy hết thì không còn gì để giao nên không vẽ thanh
export function LineProgress({ delivered, qty, cancelled = 0 }: { delivered: number; qty: number; cancelled?: number }) {
  const { t } = useTranslation();
  const total = qty - cancelled;
  if (total <= 0) return null;
  const pct = Math.min(100, Math.round((delivered / total) * 100));
  return (
    <div
      className="hs-progress"
      role="progressbar"
      aria-label={t('request.history.progress', { delivered, qty: total })}
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={delivered}
    >
      <span className="hs-bar" aria-hidden="true">
        <i style={{ width: `${pct}%` }} />
      </span>
      <span className="hs-count num" aria-hidden="true">
        {delivered}/{total}
      </span>
    </div>
  );
}
