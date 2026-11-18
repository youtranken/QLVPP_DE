import { useId, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';

// Thanh phiếu nổi trên thanh dưới (≤ 900): trái = mở sheet phiếu; phải = "Lưu phiếu" chỉ khi có thay đổi (cùng hộp xác nhận)
export function MobileSaveBar({
  count,
  units,
  savedTime,
  dirtyCount,
  openRef,
  canSave,
  onOpen,
  onSave,
}: {
  count: number;
  units: number;
  savedTime: string | null;
  dirtyCount: number;
  openRef: RefObject<HTMLButtonElement | null>;
  canSave: boolean;
  onOpen: () => void;
  onSave: () => void;
}) {
  const { t } = useTranslation();
  const titleId = useId();
  const subId = useId();
  const unitText = t('request.unitCount', { count: units });
  return (
    <div className="rq-bar">
      <button type="button" className="rq-bar-open" ref={openRef} aria-labelledby={titleId} aria-describedby={subId} onClick={onOpen}>
        <span id={titleId} className="rq-bar-title num">{t('request.cart.viewCart', { count })}</span>
        <span id={subId} className="rq-bar-sub num">{savedTime ? t('request.cart.barSaved', { units: unitText, time: savedTime }) : unitText}</span>
      </button>
      {dirtyCount > 0 && (
        <button type="button" className="rq-bar-save" disabled={!canSave} onClick={onSave}>
          <span className="sr-only">{t('request.cart.barDirty', { count: dirtyCount })} ·</span> {t('request.cart.save')}
        </button>
      )}
    </div>
  );
}
