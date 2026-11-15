import { useTranslation } from 'react-i18next';
import { logout } from '@/lib/auth-actions';
import { initialsOf } from '@/lib/initials';
import { useMe } from '@/lib/me';
import { LanguageSwitch } from '@/ui/language-switch';
import './profile.m1.css';

// Nội dung tài khoản dùng chung cho hộp ở đầu trang (máy tính), sheet điện thoại và trang /me.
// language: sheet điện thoại và /me có đổi ngôn ngữ (thanh trên ≤ 900 không còn VI/EN); hộp máy tính thì không, vì thanh trên đã có
export function AccountContent({ language = false }: { language?: boolean }) {
  const { t } = useTranslation();
  const me = useMe();
  const name = me.fullName ?? me.sub;
  const who = [me.department, t(`common.roles.${me.role}`)].filter(Boolean).join(' · ');
  const rows: [string, string | null][] = [
    ['profile.email', me.email],
    ['profile.employeeCode', me.employeeCode],
  ];
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
      {language && (
        <div className="acct-lang">
          <span className="acct-lang__label" aria-hidden="true">{t('common.languages.label')}</span>
          <LanguageSwitch className="acct-lang__seg" />
        </div>
      )}
      <button type="button" className="btn btn--danger acct-logout" onClick={() => logout(me.csrfToken, me.sub)}>
        {t('auth.logout')}
      </button>
    </div>
  );
}
