import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { loginWithPmhId } from '@/lib/auth-actions';
import { LanguageSwitch } from '@/ui/language-switch';
import { ForbiddenScreen } from '@/shell/forbidden-screen';
import { SaLoginForm } from '@/shell/sa-login-form';

function isForbiddenEntry(): boolean {
  const { pathname, search } = window.location;
  return pathname === '/forbidden' || new URLSearchParams(search).get('login') === 'forbidden';
}

type Props = { sessionExpired?: boolean; ssoDown?: boolean };

export function LoginScreen({ sessionExpired = false, ssoDown = false }: Props) {
  const { t } = useTranslation();
  const [hintOpen, setHintOpen] = useState(false);
  const [saOpen, setSaOpen] = useState(false);
  const [hint, setHint] = useState('');

  // Bị chặn quyền: bấm đăng nhập thường sẽ SSO im lặng ra access_denied lần nữa → lặp
  if (isForbiddenEntry()) return <ForbiddenScreen />;

  const loginFailed = new URLSearchParams(window.location.search).get('login') === 'failed';
  const submitHint = (e: FormEvent) => {
    e.preventDefault();
    loginWithPmhId(hint);
  };

  return (
    <div className="login-page">
      <main className="login-box">
        <section className="login-hero">
          <div className="login-brand">
            <i aria-hidden="true">{t('auth.brandBadge')}</i>
            {t('auth.brand')}
          </div>
          <h1>{t('auth.heroTitle')}</h1>
          <p>{t('auth.heroBody')}</p>
        </section>
        <section className="login-panel">
          <div className="login-head">
            <h2>{t('auth.heading')}</h2>
            <LanguageSwitch className="seg--sm" />
          </div>
          {ssoDown && (
            <p role="alert" className="alert alert--warn">
              {t('auth.ssoUnavailable')}
            </p>
          )}
          {sessionExpired && (
            <p role="alert" className="alert alert--warn">
              {t('auth.sessionExpired')}
            </p>
          )}
          {loginFailed && !sessionExpired && (
            <p role="alert" className="alert alert--danger">
              {t('auth.loginFailed')}
            </p>
          )}
          <button type="button" className="btn btn--primary btn--xl" onClick={() => loginWithPmhId()}>
            {t('auth.primary')}
          </button>
          <p className="login-hint">{t('auth.primaryHint')}</p>
          {hintOpen ? (
            <form className="login-hint-form" onSubmit={submitHint}>
              <label className="field">
                <span className="field-label">{t('auth.hintLabel')}</span>
                <input
                  type="email"
                  name="login_hint"
                  autoComplete="username"
                  placeholder={t('auth.hintPlaceholder')}
                  required
                  value={hint}
                  onChange={(e) => setHint(e.target.value)}
                />
              </label>
              <button type="submit" className="btn btn--lg">
                {t('auth.hintSubmit')}
              </button>
            </form>
          ) : (
            <button type="button" className="link-btn" onClick={() => setHintOpen(true)}>
              {t('auth.hintToggle')}
            </button>
          )}
          <div className="login-foot">
            {saOpen ? (
              <SaLoginForm />
            ) : (
              <button type="button" className="link-btn link-btn--sm" onClick={() => setSaOpen(true)}>
                {t('auth.itToggle')}
              </button>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
