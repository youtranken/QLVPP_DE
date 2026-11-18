import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { identifyLogin, loginWithPmhId, saLogin, type SaLoginOutcome } from '@/lib/auth-actions';
import { navigateTo } from '@/lib/navigate';
import { LanguageSwitch } from '@/ui/language-switch';
import { IconEye, IconEyeOff, IconLock, IconMail } from '@/ui/icons';
import { AuthFrame } from '@/shell/auth-frame';
import { ForbiddenScreen } from '@/shell/forbidden-screen';
import { TestAccountsLogin } from '@/shell/test-accounts-login';

function isForbiddenEntry(): boolean {
  const { pathname, search } = window.location;
  return pathname === '/forbidden' || new URLSearchParams(search).get('login') === 'forbidden';
}

// Nhận dạng email tối thiểu (giống QLTS/QLHS): email đi thẳng PMH ID, không hỏi server
function isEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

const SA_ERROR_KEY: Record<Exclude<SaLoginOutcome, 'ok'>, string> = {
  invalid: 'auth.saInvalid',
  locked: 'auth.saLocked',
  error: 'auth.saError',
};

const IDENTIFY_ERROR_KEY = { invalid: 'auth.idInvalid', locked: 'auth.saLocked', error: 'auth.saError' } as const;

type Props = { sessionExpired?: boolean; ssoDown?: boolean };

/**
 * Nút chính sang PMH ID ngay (ô email tùy chọn, có thì gửi login_hint); chữ không phải email → hỏi server:
 * đúng tên tài khoản nội bộ của IT mới sang bước mật khẩu (/api/auth/sa-login), còn lại báo email không hợp lệ.
 */
export function LoginScreen({ sessionExpired = false, ssoDown = false }: Props) {
  const { t } = useTranslation();
  const [step, setStep] = useState<'id' | 'password'>('id');
  const [identifier, setIdentifier] = useState('');
  // Tên server đã xác nhận là tài khoản nội bộ — bước mật khẩu dùng đúng tên này
  const [verifiedId, setVerifiedId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const idRef = useRef<HTMLInputElement>(null);
  const pwRef = useRef<HTMLInputElement>(null);
  const backToIdRef = useRef(false);

  // "Đổi" → về ô email và đặt con trỏ vào đó (không để focus rơi về <body>); sang bước mật khẩu → con trỏ ở ô mật khẩu
  // (server trả lời sau khi nút Đăng nhập đã nhận focus nên autoFocus không đủ)
  useEffect(() => {
    if (step === 'password') pwRef.current?.focus();
    if (step === 'id' && backToIdRef.current) {
      backToIdRef.current = false;
      idRef.current?.focus();
    }
  }, [step]);

  // Bị chặn quyền: bấm đăng nhập thường sẽ SSO im lặng ra access_denied lần nữa → lặp
  if (isForbiddenEntry()) return <ForbiddenScreen />;

  const loginFailed = new URLSearchParams(window.location.search).get('login') === 'failed';

  const submitId = async (e: FormEvent) => {
    e.preventDefault();
    const id = identifier.trim();
    setError(null);
    // Email chỉ để điền sẵn ở Tài khoản D&E: trống vẫn đăng nhập được
    if (!id || isEmail(id)) {
      loginWithPmhId(id || undefined);
      return;
    }
    setBusy(true);
    const next = await identifyLogin(id);
    setBusy(false);
    if (next === 'password') {
      setVerifiedId(id);
      setStep('password');
      return;
    }
    setError(t(IDENTIFY_ERROR_KEY[next]));
    idRef.current?.focus();
  };

  const submitPassword = async (e: FormEvent) => {
    e.preventDefault();
    if (!password) {
      setError(t('auth.passwordRequired'));
      return;
    }
    setBusy(true);
    setError(null);
    const outcome = await saLogin(verifiedId, password);
    if (outcome === 'ok') {
      // Về '/' rồi RequireRole đưa SA sang /admin
      navigateTo('/');
      return;
    }
    setError(t(SA_ERROR_KEY[outcome]));
    setBusy(false);
  };

  const backToId = () => {
    backToIdRef.current = true;
    setStep('id');
    setPassword('');
    setShowPassword(false);
    setError(null);
  };

  const errorNode = error && (
    <p id="login-error" role="alert" className="auth-error">
      {error}
    </p>
  );

  return (
    <AuthFrame>
      <div className="auth-card__head">
        <h1>{t('auth.heading')}</h1>
        <LanguageSwitch short className="seg--sm" />
      </div>
      {step === 'password' && <p className="auth-card__sub">{t('auth.passwordPrompt')}</p>}
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
      {step === 'id' ? (
        <form className="auth-form" onSubmit={(e) => void submitId(e)} noValidate>
          <button type="submit" className="btn btn--primary btn--lg btn--block" disabled={busy}>
            {t('auth.signInWithAccount')}
          </button>
          <label className="auth-label" htmlFor="login-id">
            {t('auth.idLabel')}
          </label>
          <div className="auth-input">
            <IconMail className="auth-input__ic" />
            <input
              ref={idRef}
              id="login-id"
              name="username"
              type="text"
              inputMode="email"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              // Như QLTS/QLHS: vào trang là gõ email ngay
              autoFocus
              // Đang hỏi server: không cho sửa tên đang kiểm
              readOnly={busy}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? 'login-error' : undefined}
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
            />
          </div>
          {errorNode}
        </form>
      ) : (
        <form className="auth-form" onSubmit={(e) => void submitPassword(e)} noValidate>
          <div className="auth-idrow">
            <span className="auth-idrow__label">{t('auth.signingInAs')}</span>
            <span className="auth-idrow__id" title={verifiedId}>
              {verifiedId}
            </span>
            <button type="button" className="auth-idrow__change" onClick={backToId} disabled={busy}>
              {t('auth.changeId')}
            </button>
          </div>
          <div className="auth-input auth-input--pw">
            <IconLock className="auth-input__ic" />
            <input
              ref={pwRef}
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              // Vừa bấm Đăng nhập ở bước trước → gõ mật khẩu tiếp
              autoFocus
              placeholder={t('auth.saPassword')}
              aria-label={t('auth.saPassword')}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? 'login-error' : undefined}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              className="auth-input__eye"
              aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
              aria-pressed={showPassword}
              onClick={() => setShowPassword((v) => !v)}
            >
              {showPassword ? <IconEyeOff /> : <IconEye />}
            </button>
          </div>
          {errorNode}
          <button type="submit" className="btn btn--primary btn--lg btn--block" disabled={busy}>
            {t('auth.submit')}
          </button>
        </form>
      )}
      <TestAccountsLogin />
    </AuthFrame>
  );
}
