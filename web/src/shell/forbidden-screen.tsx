import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { fetchJson } from '@/lib/fetch-json';
import { switchAccount } from '@/lib/auth-actions';
import { portalUrl } from '@/lib/pmh-portal';
import { IconLock } from '@/ui/icons';
import { CenterCard } from '@/shell/entry-states';

export function ForbiddenScreen({ email }: { email?: string | null }) {
  const { t } = useTranslation();
  const config = useQuery({
    queryKey: ['public-config'],
    queryFn: () => fetchJson<{ admin_contact: string }>('/api/public-config'),
  });
  const adminContact = config.data?.admin_contact?.trim() || t('auth.forbidden.defaultContact');
  return (
    <CenterCard tone="warn">
      <span className="entry-ic">
        <IconLock />
      </span>
      <h1>{t('auth.forbidden.title')}</h1>
      <p className="entry-body" aria-busy={config.isPending}>
        {config.isPending
          ? t('common.loading')
          : email
          ? t('auth.forbidden.body', { email, admin_contact: adminContact })
          : t('auth.forbidden.bodyNoEmail', { admin_contact: adminContact })}
      </p>
      <div className="entry-actions">
        <button type="button" className="btn btn--primary btn--lg" onClick={switchAccount}>
          {t('auth.forbidden.switchAccount')}
        </button>
        <a className="btn btn--lg" href={portalUrl()}>
          {t('auth.forbidden.portal')}
        </a>
      </div>
    </CenterCard>
  );
}
