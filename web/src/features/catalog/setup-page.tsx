import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/ui/page-header';
import './setup.m1.css';

export type SetupTab = 'groups' | 'units';

const TABS: { tab: SetupTab; to: string; key: string }[] = [
  { tab: 'groups', to: '/admin/categories', key: 'catalog.setup.tabGroups' },
  { tab: 'units', to: '/admin/categories/units', key: 'catalog.setup.tabUnits' },
];

// Đầu trang chung của hai tab Nhóm món / Đơn vị tính: tab là link nên đổi tab = đổi URL (đẩy lịch sử)
export function SetupHeader({ variant: tab, description, primary }: { variant: SetupTab; description: string; primary?: ReactNode }) {
  const { t } = useTranslation();
  const title = t('catalog.setup.title');
  const current = TABS.find((x) => x.tab === tab)!;
  return (
    <>
      <PageHeader crumbs={[t('nav.groups.stock'), title]} title={title} primary={primary} />
      <div className="setup-tabs" role="tablist" aria-label={title}>
        {TABS.map((x) => (
          <Link key={x.tab} role="tab" aria-selected={x.tab === tab} className="setup-tab" to={x.to}>
            {t(x.key)}
          </Link>
        ))}
      </div>
      <div className="setup-sub">
        <h2>{t(current.key)}</h2>
        <p className="page-head__desc">{description}</p>
      </div>
    </>
  );
}
