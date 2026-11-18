import * as RD from '@radix-ui/react-dialog';
import { useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode, RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { discardOptions, useOptionalConfirm } from '@/ui/confirm-context';
import { DialogPortalContext } from '@/ui/dialog-portal';
import { Icon } from '@/ui/icon';

export const DialogTitle = RD.Title;
export const DialogDescription = RD.Description;
export const DialogClose = RD.Close;

export function DialogCloseButton({ disabled = false }: { disabled?: boolean }) {
  const { t } = useTranslation();
  return (
    <RD.Close asChild>
      <button type="button" className="sheet-close" aria-label={t('common.close')} disabled={disabled}>
        <Icon name="x" size={20} />
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

// Nút mở có thể bị render lại khi hộp đang mở (panel đổi URL ?request=/?item= làm hàng vẽ lại): nhớ cách tìm lại nó
interface OpenerMark {
  el: HTMLElement;
  id: string;
  label: string | null;
  tag: string;
}

function markOf(el: Element | null): OpenerMark | null {
  if (!(el instanceof HTMLElement) || el === document.body) return null;
  return { el, id: el.id, label: el.getAttribute('aria-label'), tag: el.tagName.toLowerCase() };
}

function findAgain(m: OpenerMark): HTMLElement | null {
  if (m.el.isConnected) return m.el;
  const byId = m.id ? document.getElementById(m.id) : null;
  if (byId) return byId;
  if (!m.label) return null;
  // Nhãn chỉ đủ tin khi duy nhất: hai hàng cùng nhãn (vd hai người trùng tên) thì không đoán, để rơi về #main
  const same = document.querySelectorAll<HTMLElement>(`${m.tag}[aria-label="${CSS.escape(m.label)}"]`);
  return same.length === 1 ? same[0]! : null;
}

// Vùng nội dung chính làm chỗ trả focus dự phòng: <main> không có tabindex thì focus() không ăn, focus rơi về BODY
function mainTarget(): HTMLElement | null {
  const main = document.getElementById('main');
  if (main && !main.hasAttribute('tabindex')) main.tabIndex = -1;
  return main;
}

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
  placement,
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
  onKeyDown?: (e: ReactKeyboardEvent<HTMLDivElement>) => void;
  // Mở không qua Trigger nên Radix không biết trả focus về đâu: mặc định trả về phần tử đang focus lúc mở; nơi tự quản focus sau khi đóng thì để false
  returnFocus?: boolean;
  // Nút mở cố định (hộp có thể tự mở khi focus đang ở phần tử sắp biến mất): đóng thì focus về đây thay vì phần tử đang focus lúc mở
  opener?: RefObject<HTMLElement | null>;
  // Gọi khi hộp mở, sau khi ghi nhớ phần tử đang focus; preventDefault() để tự đặt focus thay vì phần tử đầu tiên
  onOpenAutoFocus?: (e: Event) => void;
  // Lúc đóng: trả true nếu đã tự đặt focus (vd về ô tìm sau khi giao xong) thì bỏ qua trả focus mặc định
  onCloseFocus?: () => boolean;
  // Ngăn kéo bám mép phải (panel phủ): test và CSS nhận ra qua data-placement
  placement?: 'end';
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const askConfirm = useOptionalConfirm();
  const block = dismissible ? undefined : (e: Event) => e.preventDefault();
  // Esc đang dành cho lớp nổi bên trong hộp (danh sách ô chọn, lịch): lớp đó tự đóng, hộp giữ nguyên
  const onEscape = (e: KeyboardEvent) => {
    const at = document.activeElement;
    if (at?.closest('[aria-haspopup][aria-expanded="true"], [data-esc-layer]')) e.preventDefault();
    else block?.(e);
  };
  const blockOutside = dismissible && closeOnOutside ? undefined : (e: Event) => e.preventDefault();
  const [portalEl, setPortalEl] = useState<HTMLDivElement | null>(null);
  // Ghi nhớ nút mở NGAY lúc render chuyển sang mở: DOM chưa commit nên focus còn ở nút. Đợi onOpenAutoFocus thì trễ —
  // ô trong hộp có autoFocus (hoặc hộp gắn có điều kiện) đã giật focus trước, Radix bỏ qua sự kiện đó và quên nút mở
  const opener = useRef<OpenerMark | null>(null);
  const wasOpen = useRef(false);
  if (open !== wasOpen.current) {
    wasOpen.current = open;
    if (open) opener.current = markOf(document.activeElement);
  }
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
            data-placement={placement}
            className={className}
            style={maxWidth ? { maxWidth } : undefined}
            onEscapeKeyDown={onEscape}
            onPointerDownOutside={blockOutside}
            onInteractOutside={blockOutside}
            onKeyDown={onKeyDown}
            // Hộp mở từ trong một form khác (hộp "Sản phẩm mới" trong ngăn Điều chỉnh): sự kiện submit của React nổi qua portal
            // tới form tổ tiên và gửi luôn form đó — dừng ở mép hộp, form của chính hộp vẫn nhận trước
            onSubmit={(e) => e.stopPropagation()}
            onOpenAutoFocus={onOpenAutoFocus}
            onCloseAutoFocus={(e) => {
              if (onCloseFocus?.()) {
                e.preventDefault();
                return;
              }
              const mark = markOf(openerProp?.current ?? null) ?? opener.current;
              if (!returnFocus || !mark) return;
              // Nút mở không còn và không tìm lại được → vùng nội dung chính, không để focus rơi về BODY
              const target = findAgain(mark) ?? mainTarget();
              if (!target) return;
              e.preventDefault();
              target.focus();
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
