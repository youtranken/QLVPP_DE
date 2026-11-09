import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { logout } from '@/lib/auth-actions';
import { initialsOf } from '@/lib/initials';
import { useMe } from '@/lib/me';
import './profile.m1.css';

// Nội dung tài khoản dùng chung cho hộp ở đầu trang (máy tính), sheet điện thoại và trang /me
export function AccountContent() {
  const { t } = useTranslation();
  const me = useMe();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const name = me.fullName ?? me.sub;
  const who = [me.department, t(`common.roles.${me.role}`)].filter(Boolean).join(' · ');
  const rows: [string, string | null][] = [
    ['profile.email', me.email],
    ['profile.employeeCode', me.employeeCode],
  ];
  const signOut = async () => {
    setBusy(true);
    setFailed(false);
    if (!(await logout(me.csrfToken))) {
      setFailed(true);
      setBusy(false);
    }
  };
  return (
    <div className="acct">
      <div className="acct-id">
        <span className="acct-ini" aria-hidden="true">{initialsOf(name)}</span>
        <div>
          <b className="acct-name">{name}</b>
          <div className="acct-who">{who}</div>
        </div>
      </div>
      <dl className="acct-kv">
        {rows.map(([key, value]) => (
          <div key={key}>
            <dt>{t(key)}</dt>
            <dd>{value || t('common.empty')}</dd>
          </div>
        ))}
      </dl>
      {failed && (
        <p role="alert" className="pf-alert">
          {t('auth.logoutFailed')}
        </p>
      )}
      <button type="button" className="btn btn--danger acct-logout" disabled={busy} onClick={() => void signOut()}>
        {t('auth.logout')}
      </button>
    </div>
  );
}
