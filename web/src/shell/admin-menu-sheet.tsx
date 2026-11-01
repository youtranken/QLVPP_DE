import { useTranslation } from 'react-i18next';
import { Dialog, DialogClose, DialogTitle } from '@/ui/dialog';
import { Icon } from '@/ui/icon';
import { AdminSidebar } from '@/shell/admin-sidebar';

export function AdminMenuSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t } = useTranslation();
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      className="side-sheet"
      overlayClassName="modal-backdrop"
      viewportClassName="side-sheet-viewport"
      returnFocus
    >
      <div className="side-sheet__head">
        <span className="side__logo" aria-hidden="true">
          <Icon name="pkg" />
        </span>
        <span className="side-sheet__title">
          <DialogTitle asChild>
            <h2>{t('nav.mobile.menuTitle')}</h2>
          </DialogTitle>
          <small>{t('nav.mobile.menuBrand')}</small>
        </span>
        <DialogClose className="side-sheet__close" aria-label={t('nav.mobile.closeMenu')}>
          <Icon name="x" />
        </DialogClose>
      </div>
      <AdminSidebar variant="sheet" onNavigate={() => onOpenChange(false)} />
    </Dialog>
  );
}
