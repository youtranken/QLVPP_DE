import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { ColumnDef } from '@tanstack/react-table';
import { groupTone, type Tone } from '@/lib/group-tone';
import { compareItems, orderKeyOf, type ItemOrderKey } from '@/lib/item-order';
import { DataTable } from '@/ui/data-table';
import { ItemThumb } from '@/ui/item-thumb';
import { LoadError } from '@/ui/load-state';
import { categoryLabel, useAdminItems, useAllCategories, type AdminItem, type Category } from '@/features/catalog/catalog.api';
import { matchesSearch, useRequestFormat } from '@/features/request/request-format';
import { useItemRows, type ItemSummaryRow } from './summary.api';

type Row = ItemSummaryRow & { id: string; item?: AdminItem; group: string; tone: Tone };

const CUSTOM = '~custom';
const NONE = '~none';

function groupOf(item: AdminItem | undefined, row: ItemSummaryRow, cats: Category[]): string {
  if (row.item_id === null) return CUSTOM;
  return item?.category_id && cats.some((c) => c.id === item.category_id) ? item.category_id : NONE;
}

function useRows(ym: string, q: string, lowOnly: boolean, only: string | null) {
  const rows = useItemRows(ym);
  const items = useAdminItems();
  const cats = useAllCategories();
  const data = useMemo<Row[]>(() => {
    const byId = new Map((items.data ?? []).map((i) => [i.id, i]));
    const catList = cats.data ?? [];
    const catById = new Map(catList.map((c) => [c.id, c]));
    // Món chưa có trong /admin/items (đang tải) xếp như chưa nhóm; ngoài DM luôn cuối, giữ thứ tự server
    const keyOf = (r: Row): ItemOrderKey => (r.item ? orderKeyOf(r.item, catById) : { id: r.key, name: r.name, sort_order: 0, category: null });
    const custom = (r: Row) => Number(r.group === CUSTOM);
    return (rows.data?.items ?? [])
      .map((r) => {
        const item = r.item_id ? byId.get(r.item_id) : undefined;
        return { ...r, id: r.key, item, group: groupOf(item, r, catList), tone: groupTone(catList, item?.category_id ?? null) };
      })
      .filter((r) => !only || r.key === only)
      .filter((r) => !lowOnly || (!!r.item?.usable && (r.item.stock_state === 'low' || r.item.stock_state === 'out')))
      .filter((r) => !q || matchesSearch(r.name, q))
      .sort((a, b) => custom(a) - custom(b) || (custom(a) ? 0 : compareItems(keyOf(a), keyOf(b))));
  }, [rows.data, items.data, cats.data, q, lowOnly, only]);
  return { data, rows, cats: cats.data ?? [] };
}

function StockCell({ row }: { row: Row }) {
  const { t } = useTranslation();
  if (!row.item) return <span className="sm-muted">—</span>;
  const state = row.item.stock_state;
  return (
    <span className="sm-stock">
      <span className="num">{row.item.stock_qty}</span>
      {state === 'low' && <span className="tag tag--warn">{t('summary.table.low')}</span>}
      {state === 'out' && <span className="tag tag--danger">{t('summary.table.out')}</span>}
    </span>
  );
}

function useColumns() {
  const { t } = useTranslation();
  const fmt = useRequestFormat();
  return useMemo<ColumnDef<Row, unknown>[]>(
    () => {
      const columns: ColumnDef<Row, unknown>[] = [
        {
          id: 'item',
          header: t('summary.table.item'),
          cell: ({ row: { original: r } }) => (
            <span className="sm-item">
              <ItemThumb fileId={r.item?.image_file_id ?? null} alt={r.name} tone={r.tone} size={36} />
              <span className="sm-item__name">{r.item ? fmt.name(r.item) : r.name}</span>
              {r.item?.admin_only && <span className="tag tag--dark">{t('summary.table.adminOnly')}</span>}
              {r.over_max && r.max_qty !== null && <span className="tag tag--warn">{t('warn.W12a', { max: r.max_qty })}</span>}
            </span>
          ),
        },
        { id: 'unit', header: t('summary.table.unit'), cell: ({ row }) => fmt.unit(row.original.unit) },
        { accessorKey: 'requested_qty', header: t('summary.table.qty'), meta: { className: 'num r' } },
        { accessorKey: 'people', header: t('summary.table.people'), meta: { className: 'num r' } },
        { id: 'stock', header: t('summary.table.stock'), meta: { className: 'r' }, cell: ({ row }) => <StockCell row={row.original} /> },
      ];
      return columns.map((c) => ({ ...c, enableSorting: false }));
    },
    [t, fmt],
  );
}

interface Props {
  ym: string;
  q: string;
  lowOnly: boolean;
  item: string | null;
  onClearItem: () => void;
}

export function SummaryItemTable({ ym, q, lowOnly, item, onClearItem }: Props) {
  const { t, i18n } = useTranslation();
  const fmt = useRequestFormat();
  const { data, rows, cats } = useRows(ym, q, lowOnly, item);
  // Món đã lọc không còn trong kỳ: nút vẫn hiện để bỏ lọc
  const only = item ? data.find((r) => r.key === item) : undefined;
  const columns = useColumns();
  if (rows.isError) return <LoadError onRetry={() => void rows.refetch()} />;
  const groupName = (key: string) => {
    if (key === CUSTOM) return t('summary.table.custom');
    const cat = cats.find((c) => c.id === key);
    return cat ? categoryLabel(cat, i18n.language) : t('summary.table.uncategorized');
  };
  return (
    <>
      <p className="sm-item-note">
        <Link to={`/admin/reports?ym=${ym}`}>{t('summary.table.toReports')}</Link>
      </p>
      {item && (
        <button type="button" className="flt-chip" aria-pressed="true" onClick={onClearItem}>
          {only ? t('summary.table.onlyItem', { name: only.item ? fmt.name(only.item) : only.name }) : t('summary.table.onlyItemGone')}
        </button>
      )}
      <DataTable
        data={data}
        columns={columns}
        stackOnMobile
        loading={rows.isPending}
        emptyText={t(q || lowOnly || item ? 'summary.page.noItems' : 'summary.table.emptyItems')}
        empty={{ art: 'no-match' }}
        groupBy={{
          key: (r) => r.group,
          header: (key, list) => {
            const k = list.filter((r) => r.item?.stock_state === 'low' || r.item?.stock_state === 'out').length;
            return (
              <span className="sm-group" data-tone={list[0]?.tone ?? 'g0'}>
                <b>{groupName(key)}</b>
                <span className="sm-group-meta">
                  {t('summary.table.groupItems', { n: list.length })}
                  {k > 0 && ` · ${t('summary.table.groupLow', { k })}`}
                </span>
              </span>
            );
          },
        }}
      />
    </>
  );
}
