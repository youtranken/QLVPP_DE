import type { KeyboardEvent, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { discardOptions, useOptionalConfirm } from '@/ui/confirm-context';
import { Dialog, DialogClose, DialogDescription, DialogTitle } from '@/ui/dialog';

export const DrawerTitle = DialogTitle;
export const DrawerDescription = DialogDescription;
export const DrawerClose = DialogClose;

const TYPING = 'input, textarea, select, [contenteditable="true"], [role="combobox"], [role="listbox"]';

function stepOf(e: KeyboardEvent<HTMLElement>): 'prev' | 'next' | null {
  if (e.defaultPrevented || e.ctrlKey || e.altKey || e.metaKey) return null;
  if (e.target instanceof Element && e.target.closest(TYPING)) return null;
  const key = e.key.toLowerCase();
  if (key === 'arrowdown' || key === 'j') return 'next';
  if (key === 'arrowup' || key === 'k') return 'prev';
  return null;
}

export function Drawer({
  open,
  onOpenChange,
  dirty = false,
  dismissible = true,
  width = 384,
  className,
  onPrev,
  onNext,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dirty?: boolean;
  dismissible?: boolean;
  width?: number;
  className?: string;
  onPrev?: () => void;
  onNext?: () => void;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const askConfirm = useOptionalConfirm();
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = stepOf(e);
    const go = step === 'next' ? onNext : step === 'prev' ? onPrev : undefined;
    if (!go) return;
    e.preventDefault();
    if (!dirty || !askConfirm) return go();
    void askConfirm(discardOptions(t)).then((ok) => ok && go());
  };
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      dirty={dirty}
      dismissible={dismissible}
      className={['drawer', className].filter(Boolean).join(' ')}
      overlayClassName="modal-backdrop drawer-backdrop"
      viewportClassName="drawer-viewport"
      maxWidth={width}
      onKeyDown={onKeyDown}
    >
      {children}
    </Dialog>
  );
}
