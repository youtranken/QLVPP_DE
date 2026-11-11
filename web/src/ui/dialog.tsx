import * as RD from '@radix-ui/react-dialog';
import { useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { KeyboardEvent, ReactNode, RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { discardOptions, useOptionalConfirm } from '@/ui/confirm-context';
import { DialogPortalContext } from '@/ui/dialog-portal';
import { IconX } from '@/ui/icons';

export const DialogTitle = RD.Title;
export const DialogDescription = RD.Description;
export const DialogClose = RD.Close;

// IconX vẽ tại chỗ thay vì dùng sprite: hộp xác nhận còn mở trong khung nhân viên, nơi không có IconSprite
export function DialogCloseButton({ disabled = false }: { disabled?: boolean }) {
  const { t } = useTranslation();
  return (
    <RD.Close asChild>
      <button type="button" className="sheet-close" aria-label={t('common.close')} disabled={disabled}>
        <IconX width={20} height={20} strokeWidth={2} focusable={false} />
      </button>
    </RD.Close>
  );
}

// Hộp modal mở/đóng/gắn vào DOM → các hộp đang mở tính lại "có hộp modal nào nằm dưới mình không"
// (popover không modal như bảng thông báo, menu tài khoản cũng có role=dialog nên không đếm theo role)
let modalsVersion = 0;
const modalListeners = new Set<() => void>();
function modalsChanged(): void {
  modalsVersion++;
  modalListeners.forEach((l) => l());
}
function subscribeModals(l: () => void): () => void {
  modalListeners.add(l);
  return () => modalListeners.delete(l);
}
const modalsSnapshot = () => modalsVersion;

function hasModalBelow(me: HTMLElement): boolean {
  return Array.from(document.querySelectorAll('[data-modal-sheet][data-state="open"]')).some(
    (el) => el !== me && !!(el.compareDocumentPosition(me) & Node.DOCUMENT_POSITION_FOLLOWING),
  );
}

export function Dialog({
  open,
  onOpenChange,
  dismissible = true,
  closeOnOutside = true,
  className = 'sheet',
  overlayClassName = 'modal-backdrop',
  viewportClassName = 'dialog-viewport',
  maxWidth,
  dirty = false,
  onKeyDown,
  returnFocus = true,
  opener: openerProp,
  onOpenAutoFocus,
  onCloseFocus,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dismissible?: boolean;
  // false: bấm nền không đóng (giữ nội dung đang gõ), Esc vẫn đóng và vẫn hỏi "Bỏ thay đổi?" khi dirty
  closeOnOutside?: boolean;
  className?: string;
  overlayClassName?: string;
  viewportClassName?: string;
  maxWidth?: number;
  // Form đang sửa dở: đóng bằng Esc/bấm nền/✕ phải hỏi "Bỏ thay đổi?" trước
  dirty?: boolean;
  onKeyDown?: (e: KeyboardEvent<HTMLDivElement>) => void;
  // Mở không qua Trigger nên Radix không biết trả focus về đâu: mặc định trả về phần tử đang focus lúc mở; nơi tự quản focus sau khi đóng thì để false
  returnFocus?: boolean;
  // Nút mở cố định (hộp có thể tự mở khi focus đang ở phần tử sắp biến mất): đóng thì focus về đây thay vì phần tử đang focus lúc mở
  opener?: RefObject<HTMLElement | null>;
  // Gọi khi hộp mở, sau khi ghi nhớ phần tử đang focus; preventDefault() để tự đặt focus thay vì phần tử đầu tiên
  onOpenAutoFocus?: (e: Event) => void;
  // Lúc đóng: trả true nếu đã tự đặt focus (vd về ô tìm sau khi giao xong) thì bỏ qua trả focus mặc định
  onCloseFocus?: () => boolean;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const askConfirm = useOptionalConfirm();
  const block = dismissible ? undefined : (e: Event) => e.preventDefault();
  const blockOutside = dismissible && closeOnOutside ? undefined : (e: Event) => e.preventDefault();
  const [portalEl, setPortalEl] = useState<HTMLDivElement | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  // Hộp nằm trên một hộp modal khác đang mở → đánh dấu để CSS thêm viền tách lớp (z-index bằng nhau, thứ tự DOM quyết định lớp trên)
  const [content, setContent] = useState<HTMLDivElement | null>(null);
  const [stacked, setStacked] = useState(false);
  const modals = useSyncExternalStore(subscribeModals, modalsSnapshot, modalsSnapshot);
  const live = open && content !== null;
  useLayoutEffect(() => {
    if (!live) return;
    modalsChanged();
    return modalsChanged;
  }, [live]);
  useLayoutEffect(() => {
    setStacked(live && content !== null && hasModalBelow(content));
  }, [live, content, modals]);
  const handleOpenChange = (next: boolean) => {
    if (next || !dirty || !askConfirm) {
      onOpenChange(next);
      return;
    }
    void askConfirm(discardOptions(t)).then((ok) => {
      if (ok) onOpenChange(false);
    });
  };
  return (
    <RD.Root open={open} onOpenChange={handleOpenChange}>
      <RD.Portal>
        <RD.Overlay className={overlayClassName} />
        <div className={viewportClassName}>
          <RD.Content
            ref={setContent}
            data-modal-sheet=""
            data-stacked={stacked || undefined}
            className={className}
            style={maxWidth ? { maxWidth } : undefined}
            onEscapeKeyDown={block}
            onPointerDownOutside={blockOutside}
            onInteractOutside={blockOutside}
            onKeyDown={onKeyDown}
            onOpenAutoFocus={(e) => {
              opener.current = openerProp?.current ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
              onOpenAutoFocus?.(e);
            }}
            onCloseAutoFocus={(e) => {
              if (onCloseFocus?.()) {
                e.preventDefault();
                return;
              }
              if (!returnFocus || !opener.current?.isConnected) return;
              e.preventDefault();
              opener.current.focus();
            }}
          >
            <DialogPortalContext.Provider value={portalEl}>
              {children}
            </DialogPortalContext.Provider>
            <div ref={setPortalEl} />
          </RD.Content>
        </div>
      </RD.Portal>
    </RD.Root>
  );
}
