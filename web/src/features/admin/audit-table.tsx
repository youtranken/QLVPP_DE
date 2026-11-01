import { createContext, useCallback, useContext, useId, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/ui/data-table';
import type { GroupBy } from '@/ui/data-table-group';
import type { AuditEntry } from './admin.api';
import { auditActionLabel } from './audit-actions';
import { AuditDetail } from './audit-detail';
import { auditObjectName } from './audit-diff';
import { vnDayKey } from './audit-quick-ranges';

const ZONE = 'Asia/Ho_Chi_Minh';
const SHORT_ID = 8;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const shortId = (id: string) => (UUID.test(id) ? `${id.slice(0, SHORT_ID)}…` : id);
const timeFmt = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
  timeZone: ZONE,
});

interface Expansion {
  open: ReadonlySet<string>;
  toggle: (id: string) => void;
  detailId: (id: string) => string;
}
const ExpansionContext = createContext<Expansion>({
  open: new Set(),
  toggle: () => {},
  detailId: (id) => id,
});

function ToggleButton({ entryId }: { entryId: string }) {
  const { t } = useTranslation();
  const x = useContext(ExpansionContext);
  const open = x.open.has(entryId);
  const controls = x.detailId(entryId);
  const onToggle = () => x.toggle(entryId);
  return (
    <button type="button" className="btn btn--sm" aria-expanded={open} aria-controls={open ? controls : undefined} onClick={onToggle}>
      {t(open ? 'audit.page.collapse' : 'audit.page.expand')}
    </button>
  );
}

function ObjectCell({ entry: e }: { entry: AuditEntry }) {
  const { t } = useTranslation();
  if (!e.objectType && !e.objectId) return <>{t('common.empty')}</>;
  const ref = [e.objectType, e.objectId && shortId(e.objectId)].filter(Boolean).join(' · ');
  const name = auditObjectName(e.detail);
  return (
    <span className="au-object" title={e.objectId ?? undefined}>
      {name ?? ref}
      {name && <small className="au-muted">{ref}</small>}
    </span>
  );
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
        cell: ({ row: { original: e } }) => <ObjectCell entry={e} />,
      },
      {
        id: 'detail',
        header: t('audit.page.colDetail'),
        meta: { className: 'au-detail-col' },
        cell: ({ row: { original: e } }) => <ToggleButton entryId={e.id} />,
      },
    ];
    return columns.map((c) => ({ ...c, enableSorting: false }));
  }, [t]);
}

export function AuditTable({ rows, loading, empty }: { rows: AuditEntry[]; loading: boolean; empty: { title: string; hint?: string; action?: ReactNode } }) {
  const { t, i18n } = useTranslation();
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
  const columns = useColumns();
  const expansion = useMemo(() => ({ open, toggle, detailId }), [open, toggle, detailId]);
  const groupBy = useMemo<GroupBy<AuditEntry>>(() => {
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
  return (
    <ExpansionContext.Provider value={expansion}>
      <DataTable
        data={rows}
        columns={columns}
        loading={loading}
        emptyText={empty.title}
        empty={{ art: 'no-match', hint: empty.hint, action: empty.action }}
        groupBy={groupBy}
        expandedRow={(e) => (open.has(e.id) ? <AuditDetail entry={e} id={detailId(e.id)} /> : null)}
        stackOnMobile
      />
    </ExpansionContext.Provider>
  );
}
