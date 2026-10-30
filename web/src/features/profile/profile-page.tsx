import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMe } from '@/lib/me';
import { logout } from '@/lib/auth-actions';
import { LanguageSwitch } from '@/ui/language-switch';

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
    <div className="profile">
      <h1 className="page-title">{t('profile.title')}</h1>
      <section className="card">
        <h2 className="card-title">{t('profile.account')}</h2>
        <dl className="kv">
          {rows.map(([key, value]) => (
            <div key={key}>
              <dt>{t(key)}</dt>
              <dd>{value || t('common.empty')}</dd>
            </div>
          ))}
        </dl>
        <p className="profile-source">{t('profile.dataFromPmhId')}</p>
      </section>
      <section className="card">
        <h2 className="card-title">{t('common.languages.label')}</h2>
        <LanguageSwitch className="seg--block" />
      </section>
      {failed && (
        <p role="alert" className="alert alert--danger">
          {t('auth.logoutFailed')}
        </p>
      )}
      <button
        type="button"
        className="btn btn--lg btn--block btn--danger-ghost"
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
    </div>
  );
}
