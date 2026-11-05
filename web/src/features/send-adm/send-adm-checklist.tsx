import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Icon } from '@/ui/icon';
import type { PeriodSummary } from '@/features/summary/summary.api';

type Tone = 'ok' | 'warn';

function Check({ tone, text, link }: { tone: Tone; text: string; link?: { to: string; label: string } }) {
  return (
    <li className="sa-check" data-tone={tone}>
      <Icon name={tone === 'ok' ? 'check' : 'alert'} size={20} />
      <span>
        {text}
        {link && (
          <>
            {' '}
            <Link to={link.to}>{link.label}</Link>
          </>
        )}
      </span>
    </li>
  );
}

export function SendAdmChecklist({ ym, summary }: { ym: string; summary: PeriodSummary }) {
  const { t } = useTranslation();
  const missing = summary.unregistered;
  const outside = summary.custom_pending;
  return (
    <section className="sa-card" aria-labelledby="sa-check-title">
      <h2 id="sa-check-title">{t('sendAdm.checklist.title')}</h2>
      <ul className="sa-checks" aria-labelledby="sa-check-title">
        {missing > 0 ? (
          <Check tone="warn" text={t('sendAdm.checklist.unregistered', { n: missing })} link={{ to: `/admin/summary?ym=${ym}&filter=unregistered`, label: t('sendAdm.checklist.unregisteredLink') }} />
        ) : (
          <Check tone="ok" text={t('sendAdm.checklist.unregisteredOk')} />
        )}
        {outside > 0 ? (
          <Check tone="warn" text={t('sendAdm.checklist.outside', { n: outside })} link={{ to: `/admin/review?status=pending&ym=${ym}`, label: t('sendAdm.checklist.outsideLink') }} />
        ) : (
          <Check tone="ok" text={t('sendAdm.checklist.outsideOk')} />
        )}
        <Check tone="ok" text={t('sendAdm.checklist.deducted')} />
      </ul>
    </section>
  );
}
