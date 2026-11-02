import { useCallback, useId, useMemo, useState } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/ui/data-table';
import { Icon } from '@/ui/icon';
import type { GroupBy } from '@/ui/data-table-group';
import type { AuditEntry } from './admin.api';
import { auditActionLabel } from './audit-actions';
import { AuditDetail } from './audit-detail';
import { auditObjectText } from './audit-object';
import { vnDayKey } from './audit-quick-ranges';

const ZONE = 'Asia/Ho_Chi_Minh';
const timeFmt = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
  timeZone: ZONE,
});

function ObjectCell({ entry: e }: { entry: AuditEntry }) {
  const { t } = useTranslation();
  if (!e.objectType && !e.objectId) return <>{t('common.empty')}</>;
  return <span className="au-object">{auditObjectText(t, e)}</span>;
}

function useColumns() {
  const { t } = useTranslation();
  return useMemo<ColumnDef<AuditEntry, unknown>[]>(() => {
    const columns: ColumnDef<AuditEntry, unknown>[] = [
      {
        id: 'time',
        header: t('audit.page.colTime'),
        meta: { className: 'au-nowrap' },
        cell: ({ row }) => timeFmt.format(new Date(row.original.createdAt)),
      },
      {
        id: 'actor',
        header: t('audit.page.colActor'),
        cell: ({ row: { original: e } }) => {
          const name = e.actorName ?? e.actor;
          return (
            <span className="au-person">
              <span className="au-avatar" aria-hidden="true">
                {name.trim().charAt(0).toUpperCase()}
              </span>
              <span className="au-person__name">{name}</span>
            </span>
          );
        },
      },
      {
        id: 'action',
        header: t('audit.page.colAction'),
        cell: ({ row: { original: e } }) => {
          return <span className="au-action">{auditActionLabel(t, e.action)}</span>;
        },
      },
      {
        id: 'object',
        header: t('audit.page.colObject'),
        cell: ({ row: { original: e } }) => <ObjectCell entry={e} />,
      },
      {
        id: 'detail',
        header: () => <span className="sr-only">{t('audit.page.colDetail')}</span>,
        meta: { className: 'au-detail-col' },
        cell: () => <span className="au-chev"><Icon name="chev" size={18} /></span>,
      },
    ];
    return columns.map((c) => ({ ...c, enableSorting: false }));
  }, [t]);
}

// Cả dòng là nút mở/thu chi tiết; dòng không còn phần tử bấm nào khác nên không lồng tương tác
function useRowToggle() {
  const baseId = useId();
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set());
  const toggle = useCallback((id: string) => {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);
  const detailId = useCallback((id: string) => `${baseId}-${id}`, [baseId]);
  const rowProps = useCallback(
    (e: AuditEntry) => ({
      tabIndex: 0,
      'aria-expanded': open.has(e.id),
      'aria-controls': open.has(e.id) ? detailId(e.id) : undefined,
      onClick: () => toggle(e.id),
      onKeyDown: (ev: KeyboardEvent<HTMLTableRowElement>) => {
        if (ev.target !== ev.currentTarget || (ev.key !== 'Enter' && ev.key !== ' ')) return;
        ev.preventDefault();
        toggle(e.id);
      },
    }),
    [open, toggle, detailId],
  );
  return { open, detailId, rowProps };
}

function useDayGroups(): GroupBy<AuditEntry> {
  const { t, i18n } = useTranslation();
  return useMemo<GroupBy<AuditEntry>>(() => {
    const dayFmt = new Intl.DateTimeFormat(i18n.language === 'en' ? 'en-GB' : 'vi-VN', {
      weekday: 'long',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      timeZone: ZONE,
    });
    return {
      key: (e) => vnDayKey(new Date(e.createdAt)),
      header: (key) => dayFmt.format(new Date(`${key}T12:00:00+07:00`)),
      aside: (_k, list) => <span className="au-muted">{t('audit.page.dayCount', { count: list.length })}</span>,
    };
  }, [t, i18n.language]);
}

export function AuditTable({ rows, loading, empty }: { rows: AuditEntry[]; loading: boolean; empty: { title: string; hint?: string; action?: ReactNode } }) {
  const columns = useColumns();
  const groupBy = useDayGroups();
  const { open, detailId, rowProps } = useRowToggle();
  return (
    <DataTable
      data={rows}
      columns={columns}
      loading={loading}
      emptyText={empty.title}
      empty={{ art: 'no-match', hint: empty.hint, action: empty.action }}
      groupBy={groupBy}
      expandedRow={(e) => (open.has(e.id) ? <AuditDetail entry={e} id={detailId(e.id)} /> : null)}
      rowProps={rowProps}
      tableClassName="au-table"
      stackOnMobile
    />
  );
}
