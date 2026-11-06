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

// Đầu trang chung của hai tab Nhóm món / Đơn vị tính: tab là link nên đổi tab = đổi URL (đẩy lịch sử)
export function SetupHeader({ variant: tab, description, primary }: { variant: SetupTab; description: string; primary?: ReactNode }) {
  const { t } = useTranslation();
  const title = t('catalog.setup.title');
  const current = TABS.find((x) => x.tab === tab)!;
  return (
    <>
      <PageHeader crumbs={[t('nav.groups.stock'), title]} title={title} primary={primary} />
      <div className="setup-tabs" role="tablist" aria-label={title} onKeyDown={moveFocus}>
        {TABS.map((x) => (
          <Link key={x.tab} role="tab" aria-selected={x.tab === tab} tabIndex={x.tab === tab ? 0 : -1} className="setup-tab" to={x.to}>
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
