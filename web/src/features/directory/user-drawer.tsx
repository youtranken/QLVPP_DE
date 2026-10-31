import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Drawer, DrawerClose, DrawerTitle } from '@/ui/drawer';
import { Icon } from '@/ui/icon';
import { GroupBadges, LastLogin, StatusBadge, UserAvatar, type UserRow } from './users-table';
import { nameOf } from './users-rows';

interface Props {
  user: UserRow;
  position: number;
  onPrev?: () => void;
  onNext?: () => void;
  onClose: () => void;
}

export function UserDrawer({ user, position, onPrev, onNext, onClose }: Props) {
  const { t } = useTranslation();
  const empty = t('common.empty');
  const facts: [string, ReactNode][] = [
    [t('users.drawer.email'), user.email ?? empty],
    [t('users.drawer.code'), user.employeeCode ?? empty],
    [t('users.drawer.department'), user.department ?? empty],
    [t('users.drawer.groups'), <GroupBadges key="g" groups={user.groups} />],
    [t('users.drawer.status'), <StatusBadge key="s" status={user.status} />],
    [t('users.drawer.lastLogin'), <LastLogin key="l" iso={user.lastLoginAt} />],
  ];
  return (
    <Drawer open onOpenChange={(o) => !o && onClose()} onPrev={onPrev} onNext={onNext}>
      <div className="drawer-header dr-drawer-head">
        <div className="dr-drawer-head__text">
          <small className="drawer-eyebrow">{t('users.drawer.eyebrow', { k: position })}</small>
          <DrawerTitle className="sheet-title">{t('users.drawer.title')}</DrawerTitle>
        </div>
        <button type="button" className="btn btn--ghost btn--sm dr-icon-btn" aria-label={t('users.drawer.prev')} disabled={!onPrev} onClick={onPrev}>
          <Icon name="chevup" size={18} />
        </button>
        <button type="button" className="btn btn--ghost btn--sm dr-icon-btn" aria-label={t('users.drawer.next')} disabled={!onNext} onClick={onNext}>
          <Icon name="chev" size={18} />
        </button>
      </div>
      <div className="drawer-body">
        <div className="dr-who">
          <UserAvatar user={user} large />
          <span className="dr-who__text">
            <b>{nameOf(user)}</b>
            <small className="dr-muted">{user.department ?? empty}</small>
          </span>
        </div>
        {user.status === 'locked' && (
          <p role="note" className="alert alert--warn">
            {t('users.drawer.lockedWarning')}
          </p>
        )}
        <dl className="dr-facts">
          {facts.map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
        <p className="dr-muted">{t('users.drawer.readonly')}</p>
        <Link className="btn btn--sm dr-audit-link" to={`/admin/audit?actor=${encodeURIComponent(user.sub)}`}>
          {t('users.drawer.audit')}
        </Link>
      </div>
      <div className="drawer-footer">
        <DrawerClose asChild>
          <button type="button" className="btn">
            {t('common.close')}
          </button>
        </DrawerClose>
      </div>
    </Drawer>
  );
}
