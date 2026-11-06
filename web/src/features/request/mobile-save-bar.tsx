import { useId } from 'react';
import { useTranslation } from 'react-i18next';

// Thanh phiếu nổi trên thanh dưới (≤ 900): trái = mở sheet phiếu, phải = lưu thẳng (cùng hộp xác nhận)
export function MobileSaveBar({
  count,
  units,
  saved,
  label,
  canSave,
  onOpen,
  onSave,
}: {
  count: number;
  units: number;
  saved: boolean;
  label: string;
  canSave: boolean;
  onOpen: () => void;
  onSave: () => void;
}) {
  const { t } = useTranslation();
  const titleId = useId();
  const subId = useId();
  const status = t(saved ? 'request.cart.statusSaved' : 'request.cart.statusDirty');
  return (
    <div className="rq-bar">
      <button type="button" className="rq-bar-open" aria-labelledby={titleId} aria-describedby={subId} onClick={onOpen}>
        <span id={titleId} className="rq-bar-title num">{t('request.cart.viewCart', { n: count })}</span>
        <span id={subId} className="rq-bar-sub num">{t('request.cart.barSub', { units, status })}</span>
      </button>
      <button type="button" className="rq-bar-save" disabled={!canSave} onClick={onSave}>
        {label}
      </button>
    </div>
  );
}
