import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMe } from '@/lib/me';
import { LanguageSwitch } from '@/ui/language-switch';
import { ADMIN_NAV } from '@/shell/admin-nav';

export function AdminSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = useTranslation();
  const me = useMe();
  return (
    <div className="a-side">
      <div className="a-brand">
        <i aria-hidden="true">{t('app.logoLetter')}</i>
        {t('app.adminTitle')}
      </div>
      <nav className="a-nav" aria-label={t('nav.adminMenu')}>
        {ADMIN_NAV.map((g) => (
          <div key={g.labelKey} className="a-group" role="group" aria-labelledby={`g-${g.labelKey}`}>
            <div className="a-group-label" id={`g-${g.labelKey}`}>
              {t(g.labelKey)}
            </div>
            {g.pages.map((p) => (
              <NavLink key={p.path} to={`/admin/${p.path}`} onClick={onNavigate}>
                {t(p.titleKey)}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
      <div className="a-foot">
        <b>{me.fullName ?? me.sub}</b>
        <span>{t(`common.roles.${me.role}`)}</span>
        <LanguageSwitch className="seg--dark" />
      </div>
    </div>
  );
}
