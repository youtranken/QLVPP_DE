import * as RD from '@radix-ui/react-dialog';
import { useRef, useState } from 'react';
import type { KeyboardEvent, ReactNode, SVGProps } from 'react';
import { useTranslation } from 'react-i18next';
import { discardOptions, useOptionalConfirm } from '@/ui/confirm-context';
import { DialogPortalContext } from '@/ui/dialog-portal';

const X_STROKE: SVGProps<SVGSVGElement> = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' };

export const DialogTitle = RD.Title;
export const DialogDescription = RD.Description;
export const DialogClose = RD.Close;

// Tự vẽ X thay vì dùng sprite: hộp xác nhận còn mở trong khung nhân viên, nơi không có IconSprite
export function DialogCloseButton({ disabled = false }: { disabled?: boolean }) {
  const { t } = useTranslation();
  return (
    <RD.Close asChild>
      <button type="button" className="sheet-close" aria-label={t('common.close')} disabled={disabled}>
        <svg width={20} height={20} viewBox="0 0 24 24" aria-hidden="true" focusable={false} {...X_STROKE}>
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>
    </RD.Close>
  );
}

export function Dialog({
  open,
  onOpenChange,
  dismissible = true,
  className = 'sheet',
  overlayClassName = 'modal-backdrop',
  viewportClassName = 'dialog-viewport',
  maxWidth,
  dirty = false,
  onKeyDown,
  returnFocus = true,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dismissible?: boolean;
  className?: string;
  overlayClassName?: string;
  viewportClassName?: string;
  maxWidth?: number;
  // Form đang sửa dở: đóng bằng Esc/bấm nền/✕ phải hỏi "Bỏ thay đổi?" trước
  dirty?: boolean;
  onKeyDown?: (e: KeyboardEvent<HTMLDivElement>) => void;
  // Mở không qua Trigger nên Radix không biết trả focus về đâu: mặc định trả về phần tử đang focus lúc mở; nơi tự quản focus sau khi đóng thì để false
  returnFocus?: boolean;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const askConfirm = useOptionalConfirm();
  const block = dismissible ? undefined : (e: Event) => e.preventDefault();
  const [portalEl, setPortalEl] = useState<HTMLDivElement | null>(null);
  const opener = useRef<HTMLElement | null>(null);
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
            className={className}
            style={maxWidth ? { maxWidth } : undefined}
            onEscapeKeyDown={block}
            onPointerDownOutside={block}
            onInteractOutside={block}
            onKeyDown={onKeyDown}
            onOpenAutoFocus={() => {
              opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
            }}
            onCloseAutoFocus={(e) => {
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
