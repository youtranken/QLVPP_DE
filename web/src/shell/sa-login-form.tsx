import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { saLogin, type SaLoginOutcome } from '@/lib/auth-actions';
import { navigateTo } from '@/lib/navigate';

const ERROR_KEY: Record<Exclude<SaLoginOutcome, 'ok'>, string> = {
  invalid: 'auth.saInvalid',
  locked: 'auth.saLocked',
  error: 'auth.saError',
};

export function SaLoginForm() {
  const { t } = useTranslation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const outcome = await saLogin(username, password);
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
        <span className="field-label">{t('auth.saUsername')}</span>
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
        <span className="field-label">{t('auth.saPassword')}</span>
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
        {t('auth.saSubmit')}
      </button>
    </form>
  );
}
