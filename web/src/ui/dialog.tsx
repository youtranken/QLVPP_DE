import * as RD from '@radix-ui/react-dialog';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useOptionalConfirm } from '@/ui/confirm-context';
import { DialogPortalContext } from '@/ui/dialog-portal';

export const DialogTitle = RD.Title;
export const DialogDescription = RD.Description;
export const DialogClose = RD.Close;

export function Dialog({
  open,
  onOpenChange,
  dismissible = true,
  className = 'sheet',
  overlayClassName = 'modal-backdrop',
  viewportClassName = 'dialog-viewport',
  maxWidth,
  dirty = false,
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
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const askConfirm = useOptionalConfirm();
  const block = dismissible ? undefined : (e: Event) => e.preventDefault();
  const [portalEl, setPortalEl] = useState<HTMLDivElement | null>(null);
  const handleOpenChange = (next: boolean) => {
    if (next || !dirty || !askConfirm) {
      onOpenChange(next);
      return;
    }
    void askConfirm({
      title: t('common.discardTitle'),
      message: t('common.discardBody'),
      confirmLabel: t('common.discardOk'),
      cancelLabel: t('common.discardKeep'),
      danger: true,
    }).then((ok) => {
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
