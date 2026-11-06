import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMe } from '@/lib/me';
import { logout } from '@/lib/auth-actions';
import { LanguageSwitch } from '@/ui/language-switch';
import { MemberPage } from '@/shell/member-page';
import './profile.m1.css';

export function ProfilePage() {
  const { t } = useTranslation();
  const me = useMe();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const rows: [string, string | null][] = [
    ['profile.fullName', me.fullName],
    ['profile.email', me.email],
    ['profile.department', me.department],
    ['profile.employeeCode', me.employeeCode],
    ['profile.role', t(`common.roles.${me.role}`)],
  ];

  return (
    <MemberPage title={t('profile.title')}>
      <section className="pf-card">
        <h2 className="pf-title">{t('profile.account')}</h2>
        <dl className="pf-kv">
          {rows.map(([key, value]) => (
            <div key={key}>
              <dt>{t(key)}</dt>
              <dd>{value || t('common.empty')}</dd>
            </div>
          ))}
        </dl>
        <p className="pf-source">{t('profile.dataFromPmhId')}</p>
      </section>
      <section className="pf-card pf-lang">
        <h2 className="pf-title">{t('common.languages.label')}</h2>
        <LanguageSwitch className="seg--block" />
      </section>
      {failed && (
        <p role="alert" className="pf-alert">
          {t('auth.logoutFailed')}
        </p>
      )}
      <button
        type="button"
        className="pf-logout"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setFailed(false);
          if (!(await logout(me.csrfToken))) {
            setFailed(true);
            setBusy(false);
          }
        }}
      >
        {t('auth.logout')}
      </button>
    </MemberPage>
  );
}
