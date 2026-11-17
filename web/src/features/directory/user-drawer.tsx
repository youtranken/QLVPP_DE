import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { OrderHistoryDialog } from '@/features/summary/order-history-dialog';
import { DialogClose } from '@/ui/dialog';
import { OverlayPanel, type PanelNav } from '@/ui/overlay-panel';
import { LastLogin, StatusBadge, UserAvatar, type UserRow } from './users-table';
import { nameOf } from './users-rows';

interface Props {
  user: UserRow;
  nav: Omit<PanelNav, 'prevLabel' | 'nextLabel'>;
  onClose: () => void;
}

export function UserDrawer({ user, nav, onClose }: Props) {
  const { t } = useTranslation();
  const empty = t('common.empty');
  const [history, setHistory] = useState(false);
  const facts: [string, ReactNode][] = [
    [t('users.drawer.email'), user.email ?? empty],
    [t('users.drawer.code'), user.employeeCode ?? empty],
    [t('users.drawer.department'), user.department ?? empty],
    [t('users.drawer.team'), user.team ?? empty],
    [t('users.drawer.status'), <StatusBadge key="s" status={user.status} />],
    [t('users.drawer.lastLogin'), <LastLogin key="l" iso={user.lastLoginAt} />],
  ];
  return (
    <OverlayPanel
      open
      onClose={onClose}
      title={t('users.drawer.title')}
      nav={{ ...nav, prevLabel: t('users.drawer.prev'), nextLabel: t('users.drawer.next') }}
      footer={
        <DialogClose asChild>
          <button type="button" className="btn">
            {t('common.close')}
          </button>
        </DialogClose>
      }
    >
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
      {user.status === 'no_access' && (
        <p role="note" className="alert alert--warn">
          {t('users.drawer.noAccessWarning')}
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
      <div className="dr-links">
        <button type="button" className="btn btn--sm" onClick={() => setHistory(true)}>
          {t('summary.history.open')}
        </button>
        <Link className="btn btn--sm dr-audit-link" to={`/admin/audit?actor=${encodeURIComponent(user.sub)}`}>
          {t('users.drawer.audit')}
        </Link>
      </div>
      {history && <OrderHistoryDialog sub={user.sub} name={nameOf(user)} onClose={() => setHistory(false)} />}
    </OverlayPanel>
  );
}
