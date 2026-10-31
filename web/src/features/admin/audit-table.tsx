import { useId, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/ui/data-table';
import type { GroupBy } from '@/ui/data-table-group';
import type { AuditEntry } from './admin.api';
import { auditActionLabel } from './audit-actions';
import { AuditDetail } from './audit-detail';
import { vnDayKey } from './audit-quick-ranges';

const ZONE = 'Asia/Ho_Chi_Minh';
const SHORT_ID = 8;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const shortId = (id: string) => (UUID.test(id) ? `${id.slice(0, SHORT_ID)}…` : id);
const timeFmt = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23', timeZone: ZONE });

function DetailCell({ entry }: { entry: AuditEntry }) {
  const { t } = useTranslation();
  const id = useId();
  const [open, setOpen] = useState(false);
  return (
    <div className="au-cell">
      <button type="button" className="btn btn--sm" aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)}>
        {t(open ? 'audit.page.collapse' : 'audit.page.expand')}
      </button>
      {open && <AuditDetail entry={entry} id={id} />}
    </div>
  );
}

function useColumns() {
  const { t } = useTranslation();
  return useMemo<ColumnDef<AuditEntry, unknown>[]>(() => {
    const columns: ColumnDef<AuditEntry, unknown>[] = [
      { id: 'time', header: t('audit.page.colTime'), meta: { className: 'nowrap' }, cell: ({ row }) => timeFmt.format(new Date(row.original.createdAt)) },
      {
        id: 'actor',
        header: t('audit.page.colActor'),
        cell: ({ row: { original: e } }) => {
          const name = e.actorName ?? e.actor;
          return (
            <span className="au-person">
              <span className="au-avatar" aria-hidden="true">{name.trim().charAt(0).toUpperCase()}</span>
              <span className="au-person__name">{name}</span>
            </span>
          );
        },
      },
      {
        id: 'action',
        header: t('audit.page.colAction'),
        cell: ({ row: { original: e } }) => {
          const label = auditActionLabel(t, e.action);
          return (
            <span className="au-action">
              <span>{label}</span>
              {label !== e.action && <small className="au-muted">{e.action}</small>}
            </span>
          );
        },
      },
      {
        id: 'object',
        header: t('audit.page.colObject'),
        cell: ({ row: { original: e } }) =>
          e.objectType || e.objectId ? (
            <span title={e.objectId ?? undefined}>{[e.objectType, e.objectId && shortId(e.objectId)].filter(Boolean).join(' · ')}</span>
          ) : (
            t('common.empty')
          ),
      },
      {
        id: 'detail',
        header: t('audit.page.colDetail'),
        meta: { className: 'au-detail-col' },
        cell: ({ row: { original: e } }) => <DetailCell entry={e} />,
      },
    ];
    return columns.map((c) => ({ ...c, enableSorting: false }));
  }, [t]);
}

export function AuditTable({ rows, loading, empty }: { rows: AuditEntry[]; loading: boolean; empty: { title: string; hint?: string; action?: ReactNode } }) {
  const { t, i18n } = useTranslation();
  const columns = useColumns();
  const groupBy = useMemo<GroupBy<AuditEntry>>(() => {
    const dayFmt = new Intl.DateTimeFormat(i18n.language === 'en' ? 'en-GB' : 'vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric', timeZone: ZONE });
    return {
      key: (e) => vnDayKey(new Date(e.createdAt)),
      header: (key) => dayFmt.format(new Date(`${key}T12:00:00+07:00`)),
      aside: (_k, list) => <span className="au-muted">{t('audit.page.dayCount', { count: list.length })}</span>,
    };
  }, [t, i18n.language]);
  return (
    <DataTable
      data={rows}
      columns={columns}
      loading={loading}
      emptyText={empty.title}
      empty={{ art: 'no-match', hint: empty.hint, action: empty.action }}
      groupBy={groupBy}
      stackOnMobile
    />
  );
}
