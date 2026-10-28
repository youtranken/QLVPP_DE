import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { ColumnDef } from '@tanstack/react-table';
import { useFormatTime } from '@/lib/format-time';
import type { AdminUser } from '@/features/admin/admin.api';

export function useUsersColumns(): ColumnDef<AdminUser, unknown>[] {
  const { t } = useTranslation();
  const formatTime = useFormatTime();
  return useMemo(
    () => [
      {
        id: 'name',
        accessorFn: (u) => u.fullName ?? u.sub,
        header: t('users.page.colName'),
        cell: ({ row }) => (
          <div className="item-name">
            <b>{row.original.fullName ?? row.original.sub}</b>
            {row.original.email && <small>{row.original.email}</small>}
          </div>
        ),
      },
      { id: 'code', accessorFn: (u) => u.employeeCode ?? t('common.empty'), header: t('users.page.colCode') },
      { id: 'department', accessorFn: (u) => u.department ?? t('common.empty'), header: t('users.page.colDepartment') },
      {
        id: 'groups',
        header: t('users.page.colGroups'),
        enableSorting: false,
        cell: ({ row }) => (
          <div className="tag-list">
            {row.original.groups.map((g) => (
              <span key={g} className="tag">
                {g}
              </span>
            ))}
          </div>
        ),
      },
      {
        accessorKey: 'status',
        header: t('users.page.colStatus'),
        cell: ({ row }) => (
          <span className={row.original.status === 'locked' ? 'tag tag--danger' : 'tag tag--ok'}>
            {t(`users.status.${row.original.status}`)}
          </span>
        ),
      },
      {
        id: 'lastLogin',
        accessorFn: (u) => u.lastLoginAt ?? '',
        header: t('users.page.colLastLogin'),
        cell: ({ row }) =>
          row.original.lastLoginAt ? formatTime(row.original.lastLoginAt) : (
            <span className="muted">{t('users.page.neverLoggedIn')}</span>
          ),
      },
    ],
    [t, formatTime],
  );
}
