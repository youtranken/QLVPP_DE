import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/ui/data-table';
import { InfoTip } from '@/ui/info-tip';
import { ADMIN_PHONE_QUERY, useMediaQuery } from '@/lib/use-media-query';
import { categoryLabel, useAdminItems, useAllCategories, type Category } from '@/features/catalog/catalog.api';
import { useUnitNames } from '@/features/units/units.api';
import type { MonthReport } from './reports.api';
import { CUSTOM_GROUP, NONE_GROUP, part1Name, part1Rows, type Part1Row } from './report-part1-rows';
import { OrderColumnCell } from './report-order-cell';
import { ReportSection } from './report-section';
import { OrderQtyContext, type OrderQty } from './use-order-qty';

function NeedTip({ showLabel = false }: { showLabel?: boolean }) {
  const { t } = useTranslation();
  return (
    <InfoTip label={t('reports.page.how.title')} showLabel={showLabel}>
      <p>{t('reports.page.how.formula')}</p>
      <p>{t('reports.page.how.order')}</p>
    </InfoTip>
  );
}

// Điện thoại không có đầu cột (bảng xếp chồng) nên nút (i) chuyển lên công cụ của Phần 1
function useColumns(withPeople: boolean, phone: boolean) {
  const { t, i18n } = useTranslation();
  const unitName = useUnitNames();
  return useMemo<ColumnDef<Part1Row, unknown>[]>(() => {
    const col = (k: string) => t(`reports.part1.${k}`);
    const nameOf = (r: Part1Row) => part1Name(r, i18n.language);
    const num = { meta: { className: 'num r' } };
    const columns: ColumnDef<Part1Row, unknown>[] = [
      {
        id: 'name',
        header: col('colName'),
        cell: ({ row: { original: r } }) => (
          <span className="bc-item">
            <b className="bc-item__name">{nameOf(r)}</b>
            {r.packNote && <small className="bc-item__note">{r.packNote}</small>}
          </span>
        ),
      },
      { id: 'unit', header: col('colUnit'), cell: ({ row }) => unitName(row.original.row.unit) },
      { id: 'requested', header: col('colRequested'), ...num, cell: ({ row }) => row.original.row.requested },
      { id: 'backlog', header: col('colBacklog'), ...num, cell: ({ row }) => row.original.row.backlog_prev },
      { id: 'stock', header: col('colStock'), ...num, cell: ({ row }) => row.original.row.stock ?? '—' },
      {
        id: 'need',
        header: phone
          ? col('colNeed')
          : () => (
              <>
                {col('colNeed')}
                <NeedTip />
              </>
            ),
        meta: { className: 'num r', label: col('colNeed') },
        cell: ({ row }) => row.original.row.need,
      },
      {
        id: 'order',
        header: col('colOrder'),
        meta: { className: 'r bc-order-col' },
        cell: OrderColumnCell,
      },
      { id: 'people', header: col('colPeople'), ...num, cell: ({ row }) => ('people' in row.original.row ? row.original.row.people : '') },
    ];
    // Số người chỉ có ở hàng ngoài danh mục — không có hàng nào thì bỏ hẳn cột rỗng
    return columns.filter((c) => withPeople || c.id !== 'people').map((c) => ({ ...c, enableSorting: false }));
  }, [t, i18n.language, unitName, withPeople, phone]);
}

function useGroupName(cats: Category[]) {
  const { t, i18n } = useTranslation();
  return (key: string) => {
    if (key === CUSTOM_GROUP) return t('reports.part1.custom');
    const cat = key === NONE_GROUP ? undefined : cats.find((c) => c.id === key);
    return cat ? categoryLabel(cat, i18n.language) : t('reports.part1.uncategorized');
  };
}

export function ReportPart1({ report, qty }: { report: MonthReport; qty: OrderQty }) {
  const { t } = useTranslation();
  const items = useAdminItems();
  const cats = useAllCategories();
  const [onlyNeed, setOnlyNeed] = useState(false);
  const phone = useMediaQuery(ADMIN_PHONE_QUERY);
  const columns = useColumns(report.custom.length > 0, phone);
  const groupName = useGroupName(cats.data ?? []);
  // Chờ nhóm và món tải xong (lỗi thì về "Chưa xếp nhóm") để hàng không đổi nhóm, ô đang gõ không bị dựng lại
  const settled = !items.isPending && !cats.isPending;
  const all = useMemo(() => (settled ? part1Rows(report, items.data, cats.data) : []), [settled, report, items.data, cats.data]);
  // Hàng đã sửa hoặc đang lỗi luôn hiện để người dùng thấy số mình gõ
  const rows = onlyNeed ? all.filter((r) => r.row.need > 0 || qty.isEdited(r.id) || qty.hasError(r.id)) : all;
  const groupsFailed = items.isError || cats.isError;
  const retryGroups = () => {
    if (items.isError) void items.refetch();
    if (cats.isError) void cats.refetch();
  };
  const tools = (
    <>
      <label className="bc-switch">
        <input type="checkbox" checked={onlyNeed} onChange={(e) => setOnlyNeed(e.target.checked)} />
        {t('reports.part1.onlyNeed')}
      </label>
      {phone && <NeedTip showLabel />}
      {qty.editedCount > 0 && (
        <button type="button" className="btn btn--ghost btn--sm" onClick={qty.resetAll}>
          {t('reports.part1.resetAll', { count: qty.editedCount })}
        </button>
      )}
    </>
  );
  return (
    <ReportSection title={t('reports.part1.title')} tools={tools}>
      {groupsFailed && (
        <p className="alert alert--warn bc-inline-notice">
          {t('reports.part1.groupsFailed')}
          <button type="button" className="btn btn--sm" onClick={retryGroups}>
            {t('reports.part1.retry')}
          </button>
        </p>
      )}
      <OrderQtyContext.Provider value={qty}>
        <DataTable
          data={rows}
          columns={columns}
          stackOnMobile
          tableClassName="bc-table bc-grid"
          loading={!settled}
          emptyText={t(onlyNeed ? 'reports.part1.emptyNeed' : 'reports.part1.empty')}
          rowClassName={(r) => (qty.hasError(r.id) ? 'has-error' : '')}
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
      </OrderQtyContext.Provider>
      <p className="bc-foot">{t('reports.part1.rows', { count: rows.length })}</p>
    </ReportSection>
  );
}
