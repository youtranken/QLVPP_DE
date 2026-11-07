import type { KeyboardEvent, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/ui/page-header';
import './setup.m1.css';

export type SetupTab = 'groups' | 'units';

const TABS: { tab: SetupTab; to: string; key: string }[] = [
  { tab: 'groups', to: '/admin/categories', key: 'catalog.setup.tabGroups' },
  { tab: 'units', to: '/admin/categories/units', key: 'catalog.setup.tabUnits' },
];

// Tab là link: ←/→ chỉ chuyển focus (vòng), Enter mới đổi trang
function moveFocus(e: KeyboardEvent<HTMLDivElement>) {
  const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
  if (step === 0) return;
  const tabs = [...e.currentTarget.querySelectorAll<HTMLElement>('[role="tab"]')];
  const at = tabs.indexOf(document.activeElement as HTMLElement);
  if (at < 0) return;
  e.preventDefault();
  tabs[(at + step + tabs.length) % tabs.length].focus();
}

// Đầu trang chung của hai tab Nhóm sản phẩm / Đơn vị tính: tab là link nên đổi tab = đổi URL (đẩy lịch sử)
export function SetupHeader({ variant: tab, description, primary, tabsEnd }: { variant: SetupTab; description: string; primary?: ReactNode; tabsEnd?: ReactNode }) {
  const { t } = useTranslation();
  const title = t('catalog.setup.title');
  return (
    <>
      <PageHeader crumbs={[t('nav.groups.stock'), title]} title={title} description={description} primary={primary} />
      <div className="setup-row">
        <div className="setup-tabs" role="tablist" aria-label={title} onKeyDown={moveFocus}>
          {TABS.map((x) => (
            <Link key={x.tab} role="tab" aria-selected={x.tab === tab} tabIndex={x.tab === tab ? 0 : -1} className="setup-tab" to={x.to}>
              {t(x.key)}
            </Link>
          ))}
        </div>
        {tabsEnd}
      </div>
    </>
  );
}
