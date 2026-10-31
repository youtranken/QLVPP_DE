import { useId, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { LoadError, Loading } from '@/ui/load-state';
import { PageHeader } from '@/ui/page-header';
import { discardOptions, useConfirm } from '@/ui/confirm-context';
import { useLeaveGuard } from '@/features/request/use-leave-guard';
import { useAdminConfig, type AdminConfig } from './admin.api';
import { AccessBlock } from './access-block';
import { accessSpec, contactSpec, periodSpec, signersSpec } from './config-form';
import { ContactBlock } from './contact-block';
import { PeriodBlock } from './period-block';
import { RecentChanges } from './recent-changes';
import { SignatureBoxesBlock } from './signature-boxes-block';
import { useConfigBlock } from './use-config-block';
import './config.m1.css';

export function ConfigPage() {
  const { t } = useTranslation();
  const config = useAdminConfig();
  const title = t('config.title');
  const header = <PageHeader crumbs={[t('nav.groups.system'), title]} title={title} description={t('config.page.description')} />;
  if (config.isError) {
    return (
      <div className="ct-page">
        {header}
        <LoadError onRetry={() => void config.refetch()} />
      </div>
    );
  }
  if (!config.data) return <Loading />;
  return <ConfigForm config={config.data} />;
}

function ConfigForm({ config }: { config: AdminConfig }) {
  const { t } = useTranslation();
  const ask = useConfirm();
  const period = useConfigBlock(periodSpec, config);
  const confirmGroup = (): Promise<boolean> =>
    ask({
      title: t('config.access.confirmTitle'),
      message: t('config.access.confirmBody', { group: access.draft.admin_group.trim() }),
      confirmLabel: t('config.access.confirmOk'),
      cancelLabel: t('config.cancel'),
      danger: true,
    });
  const access = useConfigBlock(accessSpec, config, confirmGroup);
  const signers = useConfigBlock(signersSpec, config);
  const contact = useConfigBlock(contactSpec, config);

  const blocks = { period, access, signers, contact };
  const dirtyNames = (Object.keys(blocks) as (keyof typeof blocks)[]).filter((k) => blocks[k].dirty).map((k) => t(`config.${k}.title`));
  const dirtyList = dirtyNames.join(', ');
  const prompt = useMemo(() => ({ ...discardOptions(t), message: t('config.page.leaveBody', { blocks: dirtyList }) }), [t, dirtyList]);
  useLeaveGuard(dirtyNames.length, prompt);
  const title = t('config.title');
  const howId = useId();

  return (
    <div className="ct-page">
      <PageHeader
        crumbs={[t('nav.groups.system'), title]}
        title={title}
        description={t('config.page.description')}
        actions={dirtyNames.length > 0 ? <span className="tag tag--warn">{t('config.page.dirty', { count: dirtyNames.length })}</span> : undefined}
      />
      <div className="cf-layout">
        <div className="cf-blocks">
          <PeriodBlock state={period} />
          <AccessBlock state={access} authorizedGroups={config.authorized_groups} />
          <SignatureBoxesBlock state={signers} />
          <ContactBlock state={contact} />
        </div>
        <aside className="cf-aside">
          <section className="cf-aside__card" aria-labelledby={howId}>
            <h2 id={howId}>{t('config.page.howTitle')}</h2>
            <ul>
              <li>{t('config.page.how1')}</li>
              <li>{t('config.page.how2')}</li>
              <li>{t('config.page.how3')}</li>
            </ul>
          </section>
          <RecentChanges />
        </aside>
      </div>
    </div>
  );
}
