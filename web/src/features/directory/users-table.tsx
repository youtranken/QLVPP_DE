import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { ColumnDef } from '@tanstack/react-table';
import { formatVnStamp } from '@/lib/format-time';
import { DataTable } from '@/ui/data-table';
import type { ReactNode } from 'react';
import type { AdminUser } from './directory.api';
import { nameOf } from './users-rows';

export type UserRow = AdminUser & { id: string };

export function UserAvatar({ user, large = false }: { user: Pick<AdminUser, 'sub' | 'fullName'>; large?: boolean }) {
  const letter = nameOf(user).trim().charAt(0).toUpperCase();
  return (
    <span className={large ? 'dr-avatar dr-avatar--lg' : 'dr-avatar'} aria-hidden="true">
      {letter}
    </span>
  );
}

export function StatusBadge({ status }: { status: AdminUser['status'] }) {
  const { t } = useTranslation();
  return <span className={status === 'locked' ? 'tag tag--danger' : 'tag tag--ok'}>{t(`users.status.${status}`)}</span>;
}

export function GroupBadges({ groups }: { groups: string[] }) {
  const { t } = useTranslation();
  if (groups.length === 0) return <span className="dr-muted">{t('common.empty')}</span>;
  return (
    <span className="dr-groups">
      {groups.map((g) => (
        <span key={g} className="tag tag--outline">
          {g}
        </span>
      ))}
    </span>
  );
}

export function LastLogin({ iso }: { iso: string | null }) {
  const { t } = useTranslation();
  return iso ? <>{formatVnStamp(iso, true)}</> : <span className="dr-muted">{t('users.page.neverLoggedIn')}</span>;
}

function useColumns(onOpen: (u: UserRow) => void) {
  const { t } = useTranslation();
  return useMemo<ColumnDef<UserRow, unknown>[]>(() => {
    const columns: ColumnDef<UserRow, unknown>[] = [
        {
          id: 'name',
          header: t('users.page.colName'),
          cell: ({ row: { original: u } }) => (
            <span className="dr-person">
              <UserAvatar user={u} />
              <span className="dr-person__text">
                <button type="button" className="dr-person__name" onClick={() => onOpen(u)}>
                  {nameOf(u)}
                </button>
                {u.email && <small className="dr-muted">{u.email}</small>}
              </span>
            </span>
          ),
        },
        { id: 'code', header: t('users.page.colCode'), cell: ({ row }) => row.original.employeeCode ?? t('common.empty') },
        { id: 'department', header: t('users.page.colDepartment'), cell: ({ row }) => row.original.department ?? t('common.empty') },
        { id: 'groups', header: t('users.page.colGroups'), cell: ({ row }) => <GroupBadges groups={row.original.groups} /> },
        { id: 'status', header: t('users.page.colStatus'), cell: ({ row }) => <StatusBadge status={row.original.status} /> },
        { id: 'lastLogin', header: t('users.page.colLastLogin'), cell: ({ row }) => <LastLogin iso={row.original.lastLoginAt} /> },
    ];
    return columns.map((c) => ({ ...c, enableSorting: false }));
  }, [t, onOpen]);
}

export function UsersTable({
  rows,
  loading,
  activeId,
  empty,
  onOpen,
}: {
  rows: UserRow[];
  loading: boolean;
  activeId?: string;
  empty: { title: string; hint: string; action: ReactNode };
  onOpen: (u: UserRow) => void;
}) {
  const columns = useColumns(onOpen);
  return (
    <DataTable
      data={rows}
      columns={columns}
      loading={loading}
      emptyText={empty.title}
      empty={{ art: 'no-match', hint: empty.hint, action: empty.action }}
      activeRowId={activeId}
      onRowClick={onOpen}
      rowClassName={(u) => (u.status === 'locked' ? 'is-inactive' : '')}
      stackOnMobile
    />
  );
}
