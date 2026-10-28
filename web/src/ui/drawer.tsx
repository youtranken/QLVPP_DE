import type { ReactNode } from 'react';
import { Dialog, DialogClose, DialogDescription, DialogTitle } from '@/ui/dialog';

export const DrawerTitle = DialogTitle;
export const DrawerDescription = DialogDescription;
export const DrawerClose = DialogClose;

// Ngăn trượt từ phải: cùng Radix Dialog (bẫy focus, Esc, hỏi bỏ thay đổi) — chỉ khác bố cục
export function Drawer({
  open,
  onOpenChange,
  dirty = false,
  dismissible = true,
  width = 520,
  className,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dirty?: boolean;
  dismissible?: boolean;
  width?: number;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      dirty={dirty}
      dismissible={dismissible}
      className={['drawer', className].filter(Boolean).join(' ')}
      viewportClassName="drawer-viewport"
      maxWidth={width}
    >
      {children}
    </Dialog>
  );
}
