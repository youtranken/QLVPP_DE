import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { IconAlert } from '@/ui/icons';

export function CenterCard({ children, tone }: { children: ReactNode; tone?: 'danger' }) {
  return (
    <div className="entry-page">
      <main className={`entry-card${tone ? ` is-${tone}` : ''}`}>{children}</main>
    </div>
  );
}

export function EntryLoading() {
  const { t } = useTranslation();
  return (
    <div className="entry-page">
      <div className="load-state" role="status" aria-live="polite">
        <span className="spinner" aria-hidden="true" />
        <span>{t('common.checkingSession')}</span>
      </div>
    </div>
  );
}

export function EntryError({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <CenterCard tone="danger">
      <span className="entry-ic">
        <IconAlert />
      </span>
      <p role="alert">{t('common.systemError')}</p>
      <button type="button" className="btn btn--primary btn--lg" onClick={onRetry}>
        {t('common.retry')}
      </button>
    </CenterCard>
  );
}

export function SsoRedirecting({ href }: { href: string }) {
  const { t } = useTranslation();
  return (
    <CenterCard>
      <span className="spinner" aria-hidden="true" />
      <h1 aria-live="polite">{t('auth.ssoRedirecting')}</h1>
      <a href={href}>{t('auth.ssoManual')}</a>
    </CenterCard>
  );
}
