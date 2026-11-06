import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import type { ColumnDef } from '@tanstack/react-table';
import { formatVnStamp } from '@/lib/format-time';
import { DataTable } from '@/ui/data-table';
import { InfoTip } from '@/ui/info-tip';
import { ADMIN_PHONE_QUERY, useMediaQuery } from '@/lib/use-media-query';
import { categoryLabel, useAdminItems, useAllCategories, type Category } from '@/features/catalog/catalog.api';
import { useUnitNames } from '@/features/units/units.api';
import type { SentSnapshot } from '@/features/send-adm/send-adm.api';
import type { MonthReport } from './reports.api';
import { CUSTOM_GROUP, NONE_GROUP, part1Name, part1Rows, type Part1Numbers, type Part1Row } from './report-part1-rows';
import { ReportSection } from './report-section';

function NeedTip({ showLabel = false }: { showLabel?: boolean }) {
  const { t } = useTranslation();
  return (
    <InfoTip label={t('reports.page.how.title')} showLabel={showLabel}>
      <p>{t('reports.page.how.formula')}</p>
    </InfoTip>
  );
}

interface ColumnSet {
  people: boolean;
  received: boolean;
  delivered: boolean;
}

const numCol = (id: keyof Part1Numbers, header: string): ColumnDef<Part1Row, unknown> => ({
  id,
  header,
  meta: { className: 'num r', label: header },
  cell: ({ row }) => row.original.n[id] ?? '—',
});

// Điện thoại không có đầu cột (bảng xếp chồng) nên nút (i) chuyển lên công cụ của Phần 1
function useColumns(set: ColumnSet, phone: boolean) {
  const { t, i18n } = useTranslation();
  const unitName = useUnitNames();
  return useMemo<ColumnDef<Part1Row, unknown>[]>(() => {
    const col = (k: string) => t(`sendAdm.orders.${k}`);
    const need = col('need');
    const columns: ColumnDef<Part1Row, unknown>[] = [
      {
        id: 'name',
        header: col('item'),
        cell: ({ row: { original: r } }) => (
          <span className="bc-item">
            <b className="bc-item__name">{part1Name(r, i18n.language)}</b>
            {r.packNote && <small className="bc-item__note">{r.packNote}</small>}
          </span>
        ),
      },
      { id: 'unit', header: t('reports.part1.colUnit'), cell: ({ row }) => unitName(row.original.row.unit) },
      numCol('registered', col('registered')),
      numCol('backlog', col('backlog')),
      numCol('stock', col('stock')),
      {
        id: 'want',
        meta: { className: 'num r', label: need },
        cell: ({ row }) => row.original.n.want,
        header: phone
          ? need
          : () => (
              <>
                {need}
                <NeedTip />
              </>
            ),
      },
      { id: 'order', header: col('qty'), meta: { className: 'num r bc-order-col', label: col('qty') }, cell: ({ row }) => <b>{row.original.n.order}</b> },
      ...(set.received ? [numCol('received', t('reports.part1.colReceived'))] : []),
      ...(set.delivered ? [numCol('delivered', col('delivered'))] : []),
    ];
    // Số người chỉ có ở hàng ngoài danh mục — không có hàng nào thì bỏ hẳn cột rỗng
    if (set.people) {
      const people = t('reports.part1.colPeople');
      columns.push({ id: 'people', header: people, meta: { className: 'num r', label: people }, cell: ({ row }) => ('people' in row.original.row ? row.original.row.people : '') });
    }
    return columns.map((c) => ({ ...c, enableSorting: false }));
  }, [t, i18n.language, unitName, set.people, set.received, set.delivered, phone]);
}

function useGroupName(cats: Category[]) {
  const { t, i18n } = useTranslation();
  return (key: string) => {
    if (key === CUSTOM_GROUP) return t('reports.part1.custom');
    const cat = key === NONE_GROUP ? undefined : cats.find((c) => c.id === key);
    return cat ? categoryLabel(cat, i18n.language) : t('reports.part1.uncategorized');
  };
}

function SourceNote({ sent, editable }: { sent: SentSnapshot | null; editable: boolean }) {
  const { t } = useTranslation();
  return (
    <>
      <span>{sent ? t('reports.page.sentSource', { time: formatVnStamp(sent.created_at) }) : t('reports.page.draftSource')}</span>
      {editable && (
        <>
          {' · '}
          <Link to="/admin/send-adm">{t('reports.page.editAtSendAdm')}</Link>
        </>
      )}
    </>
  );
}

interface Props {
  report: MonthReport;
  // Bản có hàng mới nhất của kỳ; kỳ chưa gửi hoặc đang mở thì null
  sent: SentSnapshot | null;
  // Gửi ADM chỉ làm việc trên kỳ khóa gần nhất
  editable: boolean;
}

// Kỳ đã gửi: hàng theo bản đã gửi (kỳ giao hết vẫn đủ hàng) kèm cột sống Đã về, Đã giao
export function ReportPart1({ report, sent, editable }: Props) {
  const { t } = useTranslation();
  const items = useAdminItems();
  const cats = useAllCategories();
  const [onlyNeed, setOnlyNeed] = useState(false);
  const phone = useMediaQuery(ADMIN_PHONE_QUERY);
  const groupName = useGroupName(cats.data ?? []);
  // Chờ nhóm và món tải xong (lỗi thì về "Chưa xếp nhóm") để hàng không đổi nhóm
  const settled = !items.isPending && !cats.isPending;
  const source = sent?.data ?? report;
  const all = useMemo(
    () => (settled ? part1Rows(source, items.data, cats.data, { progress: report.progress, sent: sent?.data ?? null }) : []),
    [settled, source, report.progress, sent, items.data, cats.data],
  );
  const columns = useColumns({ people: source.custom.length > 0, received: !!sent, delivered: !!sent || all.some((r) => r.n.delivered > 0) }, phone);
  const rows = onlyNeed ? all.filter((r) => r.n.want > 0) : all;
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
    </>
  );
  return (
    <ReportSection title={t('reports.part1.title')} note={<SourceNote sent={sent} editable={editable} />} tools={tools}>
      {groupsFailed && (
        <p className="alert alert--warn bc-inline-notice">
          {t('reports.part1.groupsFailed')}
          <button type="button" className="btn btn--sm" onClick={retryGroups}>
            {t('reports.part1.retry')}
          </button>
        </p>
      )}
      <DataTable
        data={rows}
        columns={columns}
        stackOnMobile
        tableClassName="bc-table bc-grid"
        loading={!settled}
        emptyText={t(onlyNeed ? 'reports.part1.emptyNeed' : 'reports.part1.empty')}
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
      <p className="bc-foot">{t('reports.part1.rows', { count: rows.length })}</p>
    </ReportSection>
  );
}
