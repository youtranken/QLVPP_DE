import type { ComponentProps, ReactNode } from 'react';
import { Dialog } from '@/ui/dialog';
import { CartPanel } from './cart-panel';

type PanelProps = Omit<ComponentProps<typeof CartPanel>, 'sheet' | 'showSave'>;

// Phiếu trên điện thoại: bottom sheet (Radix Dialog: khóa cuộn, bẫy focus, Esc đóng, trả focus về nút mở)
// Mở vì lỗi theo dòng thì focus thẳng ô số lượng của dòng lỗi (aria-invalid), không phải nút đóng
function focusInvalidLine(panel: HTMLElement | null, e: Event) {
  const bad = panel?.querySelector<HTMLElement>('[data-line-key] [aria-invalid="true"]');
  if (!bad) return;
  e.preventDefault();
  bad.scrollIntoView?.({ block: 'center' });
  bad.focus({ preventScroll: true });
}

export function CartSheet({ onOpenChange, notice, ...panel }: PanelProps & { onOpenChange: (open: boolean) => void; notice: ReactNode }) {
  return (
    <Dialog
      open
      onOpenChange={onOpenChange}
      className="rq-sheet"
      overlayClassName="modal-backdrop rq-sheet-backdrop"
      viewportClassName="rq-sheet-viewport"
      onOpenAutoFocus={(e) => focusInvalidLine(panel.panelRef.current, e)}
    >
      {notice}
      <CartPanel {...panel} sheet showSave />
    </Dialog>
  );
}
