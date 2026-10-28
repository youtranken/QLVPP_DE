import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { NARROW_QUERY, useMediaQuery } from '@/lib/use-media-query';
import { Dialog, DialogTitle } from '@/ui/dialog';
import { IconMenu } from '@/ui/icons';
import { ADMIN_PAGES } from '@/shell/admin-nav';
import { AdminSidebar } from '@/shell/admin-sidebar';
import { useShellFont } from '@/shell/use-shell-font';

function usePageTitleKey(): string {
  const { pathname } = useLocation();
  const seg = pathname.split('/')[2] ?? '';
  return ADMIN_PAGES.find((p) => p.path === seg)?.titleKey ?? 'app.adminTitle';
}

export function AdminShell() {
  const { t } = useTranslation();
  const narrow = useMediaQuery(NARROW_QUERY);
  const [menuOpen, setMenuOpen] = useState(false);
  const titleKey = usePageTitleKey();
  useShellFont('admin');

  return (
    <div className={`a-shell${narrow ? ' is-narrow' : ''}`}>
      <a className="skip-link" href="#main">
        {t('common.skipToContent')}
      </a>
      {!narrow && <AdminSidebar />}
      {narrow && (
        <Dialog open={menuOpen} onOpenChange={setMenuOpen} className="a-drawer" overlayClassName="a-scrim">
          <DialogTitle className="sr-only">{t('nav.adminMenu')}</DialogTitle>
          <AdminSidebar onNavigate={() => setMenuOpen(false)} />
        </Dialog>
      )}
      <div className="a-content">
        <header className="a-head">
          {narrow && (
            <button
              type="button"
              className="a-menu-btn"
              aria-label={t('nav.openMenu')}
              onClick={() => setMenuOpen(true)}
            >
              <IconMenu />
            </button>
          )}
          <h1>{t(titleKey)}</h1>
        </header>
        <main id="main" className="a-page">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
