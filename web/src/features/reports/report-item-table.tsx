import { createContext, useContext, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/ui/data-table';
import { InfoTip } from '@/ui/info-tip';
import { categoryLabel, type Category } from '@/features/catalog/catalog.api';
import { useUnitNames } from '@/features/units/units.api';
import { CUSTOM_GROUP, NONE_GROUP, part1Name, type Part1Row } from './report-part1-rows';
import { ReportOrderInput } from './report-order-input';
import type { OrderError } from './use-order-qty';

export interface ItemTableRow extends Part1Row {
  // Số Đề nghị đang hiện: ô nhập (kỳ khóa gần nhất) hoặc số của bản đã gửi (kỳ cũ hơn)
  order: number;
  changed: boolean;
}

interface Props {
  rows: ItemTableRow[];
  cats: Category[];
  loading: boolean;
  empty: string;
  editable: boolean;
  value: (key: string) => string;
  errorOf: (key: string) => OrderError | null;
  overMax: (key: string) => boolean;
  onEdit: (key: string, text: string) => void;
  // null = chưa có số (đang tải/lỗi): ô hiện "…" thay "—" để không đọc thành "không ai đăng ký"
  people: ReadonlyMap<string, number> | null;
  onPeople: (key: string) => void;
}

interface OrderBinding {
  editable: boolean;
  value: (key: string) => string;
  errorOf: (key: string) => OrderError | null;
  overMax: (key: string) => boolean;
  onEdit: (key: string, text: string) => void;
}

// Ô nhập đọc giá trị qua context để cột không dựng lại mỗi lần gõ (dựng lại làm mất con trỏ)
const OrderBind = createContext<OrderBinding | null>(null);

function OrderCell({ row }: { row: ItemTableRow }) {
  const { i18n } = useTranslation();
  const b = useContext(OrderBind)!;
  if (!b.editable) return <b>{row.order}</b>;
  return <ReportOrderInput name={part1Name(row, i18n.language)} value={b.value(row.id)} error={b.errorOf(row.id)} overMax={b.overMax(row.id)} onChange={(text) => b.onEdit(row.id, text)} />;
}

function useGroupName(cats: Category[]) {
  const { t, i18n } = useTranslation();
  return (key: string) => {
    if (key === CUSTOM_GROUP) return t('reports.part1.custom');
    const cat = key === NONE_GROUP ? undefined : cats.find((c) => c.id === key);
    return cat ? categoryLabel(cat, i18n.language) : t('reports.part1.uncategorized');
  };
}

export function ReportItemTable({ rows, cats, loading, empty, editable, value, errorOf, overMax, onEdit, people, onPeople }: Props) {
  const { t, i18n } = useTranslation();
  const unitName = useUnitNames();
  const groupName = useGroupName(cats);
  const columns = useMemo<ColumnDef<ItemTableRow, unknown>[]>(() => {
    const col = (k: string) => t(`sendAdm.orders.${k}`);
    const num = (id: 'registered' | 'backlog' | 'stock' | 'want', header: string): ColumnDef<ItemTableRow, unknown> => ({
      id,
      header,
      meta: { className: 'num r', label: header },
      cell: ({ row }) => row.original.n[id] ?? '—',
    });
    const need = col('need');
    const columns: ColumnDef<ItemTableRow, unknown>[] = [
      {
        id: 'name',
        header: col('item'),
        cell: ({ row: { original: r } }) => (
          <span className="bc-item">
            <b className="bc-item__name">{part1Name(r, i18n.language)}</b>
            {r.packNote && <small className="bc-item__note">{r.packNote}</small>}
            {r.changed && <span className="tag tag--warn">{t('reports.send.changedTag')}</span>}
          </span>
        ),
      },
      { id: 'unit', header: t('reports.part1.colUnit'), cell: ({ row }) => unitName(row.original.row.unit) },
      num('registered', col('registered')),
      num('backlog', col('backlog')),
      num('stock', col('stock')),
      {
        id: 'want',
        meta: { className: 'num r', label: need },
        cell: ({ row }) => row.original.n.want,
        header: () => (
          <>
            {need}
            <InfoTip label={t('reports.page.how.title')}>
              <p>{t('reports.page.how.formula')}</p>
            </InfoTip>
          </>
        ),
      },
      {
        id: 'order',
        header: col('qty'),
        meta: { className: 'num r bc-order-col', label: col('qty') },
        cell: ({ row }) => <OrderCell row={row.original} />,
      },
      {
        id: 'who',
        header: t('reports.send.colWho'),
        meta: { label: t('reports.send.colWho') },
        cell: ({ row: { original: r } }) => {
          if (!people) {
            return (
              <span className="sm-muted" aria-busy="true">
                <span aria-hidden="true">…</span>
                <span className="sr-only">{t('reports.send.whoLoading')}</span>
              </span>
            );
          }
          const n = people.get(r.id);
          return n ? (
            <button type="button" className="sa-link" aria-label={t('reports.send.whoLabel', { name: part1Name(r, i18n.language), count: n })} onClick={() => onPeople(r.id)}>
              {t('reports.send.who', { count: n })}
            </button>
          ) : (
            <span className="sm-muted">{t('common.empty')}</span>
          );
        },
      },
    ];
    return columns.map((c) => ({ ...c, enableSorting: false }));
  }, [t, i18n.language, unitName, people, onPeople]);
  const binding = useMemo(() => ({ editable, value, errorOf, overMax, onEdit }), [editable, value, errorOf, overMax, onEdit]);
  return (
    <OrderBind.Provider value={binding}>
      <DataTable
        data={rows}
        columns={columns}
        stackOnMobile
        tableClassName="bc-table grid-table"
        loading={loading}
        emptyText={empty}
        groupBy={{
          key: (r) => r.group,
          header: (key, list) => (
            <span className="bc-group" data-tone={list[0]?.tone ?? 'g0'}>
              <b>{groupName(key)}</b>
              <span className="bc-group__meta">{t('reports.part1.groupItems', { count: list.length })}</span>
            </span>
          ),
        }}
      />
    </OrderBind.Provider>
  );
}
