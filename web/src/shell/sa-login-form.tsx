import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { SaLoginOutcome } from '@/lib/auth-actions';
import { navigateTo } from '@/lib/navigate';

const ERROR_KEY: Record<Exclude<SaLoginOutcome, 'ok'>, string> = {
  invalid: 'auth.saInvalid',
  locked: 'auth.saLocked',
  error: 'auth.saError',
};

type Props = {
  login: (username: string, password: string) => Promise<SaLoginOutcome>;
  labels: { username: string; password: string; submit: string };
};

// Form tên + mật khẩu của tài khoản thử dev (SA dùng bước mật khẩu ở màn đăng nhập); về '/' rồi RequireRole chia admin/member
export function SaLoginForm({ login, labels }: Props) {
  const { t } = useTranslation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const outcome = await login(username, password);
    if (outcome === 'ok') {
      navigateTo('/');
      return;
    }
    setError(t(ERROR_KEY[outcome]));
    setBusy(false);
  };

  return (
    <form className="login-sa" onSubmit={(e) => void submit(e)}>
      {error && (
        <p role="alert" className="alert alert--danger">
          {error}
        </p>
      )}
      <label className="field">
        <span className="field-label">{t(labels.username)}</span>
        <input
          name="username"
          type="text"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          required
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
      </label>
      <label className="field">
        <span className="field-label">{t(labels.password)}</span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>
      <button type="submit" className="btn btn--lg" disabled={busy}>
        {t(labels.submit)}
      </button>
    </form>
  );
}
