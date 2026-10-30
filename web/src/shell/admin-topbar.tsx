import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogTitle } from '@/ui/dialog';
import { Icon } from '@/ui/icon';
import { NotificationBell } from '@/features/notifications/notification-bell';
import { AdminSidebar } from '@/shell/admin-sidebar';

export function AdminTopbar() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <header className="topbar">
      <button type="button" className="topbar__menu" aria-label={t('nav.openMenu')} aria-expanded={open} onClick={() => setOpen(true)}>
        <Icon name="menu" />
      </button>
      <span className="topbar__title">{t('app.title')}</span>
      <NotificationBell />
      <Dialog
        open={open}
        onOpenChange={setOpen}
        className="side-sheet"
        overlayClassName="modal-backdrop"
        viewportClassName="side-sheet-viewport"
        returnFocus
      >
        <DialogTitle className="sr-only">{t('nav.adminMenu')}</DialogTitle>
        <AdminSidebar variant="sheet" onNavigate={() => setOpen(false)} />
      </Dialog>
    </header>
  );
}
