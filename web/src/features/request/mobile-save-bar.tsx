import { useId, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';

// Thanh phiếu nổi trên thanh dưới (≤ 900): trái = mở sheet phiếu, phải = lưu thẳng (cùng hộp xác nhận); số thay đổi chưa lưu hiện bằng chữ trên nút
export function MobileSaveBar({
  count,
  units,
  savedTime,
  dirtyCount,
  openRef,
  saveRef,
  canSave,
  onOpen,
  onSave,
}: {
  count: number;
  units: number;
  savedTime: string | null;
  dirtyCount: number;
  openRef: RefObject<HTMLButtonElement | null>;
  saveRef: RefObject<HTMLButtonElement | null>;
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
      {/* aria-disabled (không disabled): lưu xong nút vẫn nhận lại focus, không rơi về body */}
      <button type="button" className="rq-bar-save" ref={saveRef} aria-disabled={!canSave} aria-describedby={canSave ? undefined : subId} onClick={() => canSave && onSave()}>
        {dirtyCount > 0 && (
          <>
            <span className="rq-bar-dirty">{t('request.cart.barDirty', { count: dirtyCount })}</span>{' '}
            <span className="sr-only">·</span>{' '}
          </>
        )}
        <span>{t('request.cart.save')}</span>
      </button>
    </div>
  );
}
