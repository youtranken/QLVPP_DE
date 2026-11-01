import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { ColumnDef } from '@tanstack/react-table';
import { groupTone } from '@/lib/group-tone';
import { DataTable } from '@/ui/data-table';
import { ADMIN_PHONE_QUERY, useMediaQuery } from '@/lib/use-media-query';
import { Icon } from '@/ui/icon';
import { ItemThumb } from '@/ui/item-thumb';
import { RowMenu } from '@/ui/row-menu';
import { useAdminItems, useAllCategories } from '@/features/catalog/catalog.api';
import type { BacklogBy } from './backlog.api';
import { useBacklogFormat } from './backlog-format';
import { isLeft, type BacklogRow } from './backlog-rows';
import { DeliveryAvatar } from './delivery-avatar';

export type LineAction = 'deliver' | 'cancel' | 'history';

interface Props {
  rows: BacklogRow[];
  by: BacklogBy;
  loading: boolean;
  filtered: boolean;
  onAction: (action: LineAction, line: BacklogRow) => void;
}

function LeftTag() {
  const { t } = useTranslation();
  return <span className="tag tag--warn">{t('delivery.backlog.left')}</span>;
}

function WhoCell({ row, by }: { row: BacklogRow; by: BacklogBy }) {
  const { t } = useTranslation();
  const f = useBacklogFormat();
  if (by === 'person') {
    return (
      <span className="bl-who">
        <b>{f.name(row)}</b>
        <small>· {f.unit(row.unit)}</small>
      </span>
    );
  }
  return (
    <span className="bl-who">
      <b>{f.person(row)}</b>
      <small>· {row.department ?? t('delivery.noDepartment')}</small>
      {isLeft(row) && <LeftTag />}
    </span>
  );
}

// Theo món, "Hết hàng" đã ở tiêu đề nhóm (cả nhóm cùng một món); theo người thì báo ở từng dòng
function Actions({ row, by, phone, onAction }: { row: BacklogRow; by: BacklogBy; phone: boolean; onAction: Props['onAction'] }) {
  const { t } = useTranslation();
  const f = useBacklogFormat();
  const who = { name: f.name(row), person: f.person(row) };
  const label = t('delivery.backlog.historyOf', who);
  const out = row.stock_qty === 0;
  const deliver = (
    <button type="button" className="btn btn--sm" disabled={out} onClick={() => onAction('deliver', row)}>
      {t('delivery.backlog.deliverMore')}
    </button>
  );
  const outTag = out && by === 'person' && <span className="tag">{t('delivery.backlog.outOfStock')}</span>;
  if (phone) {
    return (
      <span className="bl-acts">
        {outTag}
        {deliver}
        <RowMenu
          label={t('delivery.backlog.moreOf', who)}
          items={[
            { label: t('delivery.backlog.cancel'), danger: true, onSelect: () => onAction('cancel', row) },
            { label: t('delivery.backlog.history'), onSelect: () => onAction('history', row) },
          ]}
        />
      </span>
    );
  }
  return (
    <span className="bl-acts">
      {outTag}
      {deliver}
      <button type="button" className="btn btn--sm btn--danger-ghost" onClick={() => onAction('cancel', row)}>
        {t('delivery.backlog.cancel')}
      </button>
      <button
        type="button"
        className="btn btn--sm btn--ghost bl-icon-btn"
        aria-label={label}
        title={label}
        onClick={() => onAction('history', row)}
      >
        <Icon name="history" size={18} />
      </button>
    </span>
  );
}

function useColumns(by: BacklogBy, onAction: Props['onAction']) {
  const { t } = useTranslation();
  const f = useBacklogFormat();
  const phone = useMediaQuery(ADMIN_PHONE_QUERY);
  return useMemo<ColumnDef<BacklogRow, unknown>[]>(() => {
    const columns: ColumnDef<BacklogRow, unknown>[] = [
      { id: 'who', header: t(by === 'item' ? 'delivery.backlog.cols.person' : 'delivery.backlog.cols.item'), cell: ({ row }) => <WhoCell row={row.original} by={by} /> },
      { id: 'period', header: t('delivery.backlog.cols.period'), cell: ({ row }) => f.month(row.original.period_ym) },
      {
        id: 'owed',
        header: t('delivery.backlog.cols.owed'),
        meta: { className: 'num r' },
        cell: ({ row: { original: r } }) => (
          <span className="bl-owed">
            <b>{t('delivery.backlog.owed', { n: r.remaining_qty, unit: f.unit(r.unit) })}</b>
            <small>{t('delivery.backlog.ofQty', { qty: r.qty })}</small>
          </span>
        ),
      },
      {
        id: 'actions',
        header: () => <span className="sr-only">{t('delivery.backlog.cols.actions')}</span>,
        meta: { className: 'r' },
        cell: ({ row }) => <Actions row={row.original} by={by} phone={phone} onAction={onAction} />,
      },
    ];
    return columns.map((c) => ({ ...c, enableSorting: false }));
  }, [t, f, by, phone, onAction]);
}

function useGroupHead(by: BacklogBy) {
  const { t } = useTranslation();
  const f = useBacklogFormat();
  const items = useAdminItems();
  const cats = useAllCategories();
  return (_key: string, list: BacklogRow[]) => {
    const first = list[0];
    if (by === 'person') {
      return (
        <span className="bl-head">
          <DeliveryAvatar name={f.person(first)} />
          <b>{f.person(first)}</b>
          <small>{first.groupDepartment ?? t('delivery.noDepartment')}</small>
          {isLeft(first) && <LeftTag />}
        </span>
      );
    }
    const item = first.item_id ? (items.data ?? []).find((i) => i.id === first.item_id) : undefined;
    const tone = groupTone(cats.data ?? [], item?.category_id ?? null);
    return (
      <span className="bl-head" data-tone={tone}>
        <ItemThumb fileId={item?.image_file_id ?? null} alt="" tone={tone} size={36} />
        <b>{f.name(first)}</b>
        <small>{t('delivery.backlog.groupRemaining', { n: first.groupRemaining, unit: f.unit(first.unit) })}</small>
        {first.stock_qty === 0 && <span className="tag tag--danger">{t('delivery.backlog.outOfStock')}</span>}
        {first.stock_qty !== null && first.stock_qty > 0 && <small>{t('delivery.backlog.stock', { n: first.stock_qty })}</small>}
      </span>
    );
  };
}

export function BacklogTable({ rows, by, loading, filtered, onAction }: Props) {
  const { t } = useTranslation();
  const columns = useColumns(by, onAction);
  const head = useGroupHead(by);
  return (
    <DataTable
      data={rows}
      columns={columns}
      stackOnMobile
      loading={loading}
      emptyText={t(filtered ? 'delivery.backlog.noMatch' : 'delivery.backlog.empty')}
      empty={filtered ? { art: 'no-match' } : { art: 'no-backlog', hint: t('delivery.backlog.emptyHint') }}
      groupBy={{ key: (r) => r.group, header: head }}
    />
  );
}
