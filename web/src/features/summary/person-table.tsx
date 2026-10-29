import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Loading, LoadError } from '@/ui/load-state';
import { DeliveryBar } from './delivery-bar';
import { usePersonRows, type PersonRow, type SummaryFilter } from './summary.api';

interface PersonTableProps {
  ym: string;
  filter: SummaryFilter;
  q: string;
  locked: boolean;
  onAdjust: (requestId: string) => void;
}

interface CellsProps {
  row: PersonRow;
  ym: string;
  locked: boolean;
  stale: boolean;
  onAdjust: (id: string) => void;
}

function PersonCells({ row, ym, locked, stale, onAdjust }: CellsProps) {
  const { t } = useTranslation();
  const left = row.user_status !== 'active';
  const due = row.total_qty - row.cancelled_qty;
  // Chỉ giao được sau khi kỳ khóa (PERIOD_NOT_LOCKED); phiếu đã đủ không cần nút
  const canDeliver = locked && row.delivered_qty < due;
  return (
    <tr className={left ? 'is-inactive' : undefined}>
      <td data-label="">
        <span className="sm-name">{row.full_name ?? row.email ?? row.user_sub}</span>
        {row.email && <small className="sm-sub">{row.email}</small>}
      </td>
      <td className="r num" data-label={t('summary.person.colLines')}>{row.line_count}</td>
      <td className="r num" data-label={t('summary.person.colTotal')}>{row.total_qty}</td>
      <td data-label={t('summary.person.colDelivery')}>
        <DeliveryBar done={row.delivered_qty} total={due} />
      </td>
      <td data-label="">
        <span className="tag-list">
          {left && <span className="tag tag--danger">{t('summary.person.leftCompany')}</span>}
          {row.custom_pending > 0 && (
            <span className="tag tag--info">{t('summary.person.customPending', { n: row.custom_pending })}</span>
          )}
        </span>
      </td>
      <td className="r sm-acts" data-label="">
        {canDeliver && !stale && (
          <Link className="btn btn--sm" to={`/admin/delivery?ym=${ym}&request=${row.request_id}`}>
            {t('summary.person.deliver')}
          </Link>
        )}
        <button type="button" className="btn btn--sm" disabled={stale} onClick={() => onAdjust(row.request_id)}>
          {t('summary.person.adjust')}
        </button>
      </td>
    </tr>
  );
}

interface Group {
  name: string;
  rows: PersonRow[];
}

// API đã xếp phòng ban (NULL cuối) rồi tên → gom các hàng liền nhau, kể cả qua nhiều trang
function groupRows(rows: PersonRow[], nameOf: (r: PersonRow) => string): Group[] {
  const groups: Group[] = [];
  for (const row of rows) {
    const last = groups[groups.length - 1];
    if (last && last.name === nameOf(row)) last.rows.push(row);
    else groups.push({ name: nameOf(row), rows: [row] });
  }
  return groups;
}

export function PersonTable({ ym, filter, q, locked, onAdjust }: PersonTableProps) {
  const { t } = useTranslation();
  const query = usePersonRows(ym, filter, q);
  if (query.isError) return <LoadError onRetry={() => void query.refetch()} />;
  if (query.isPending) return <Loading />;
  const rows = query.data.pages.flatMap((p) => p.items);
  const groups = groupRows(rows, (r) => r.department ?? t('summary.person.noDepartment'));
  // Đang tải trang lọc/tháng mới: hàng cũ chỉ để nhìn, không được mở điều chỉnh phiếu của tháng vừa rời
  const stale = query.isPlaceholderData;

  return (
    <>
      <div className="table-wrap">
        <table className={`table table-stack sm-table${stale ? ' is-stale' : ''}`} aria-busy={stale}>
          <thead>
            <tr>
              <th>{t('summary.person.colPerson')}</th>
              <th className="r">{t('summary.person.colLines')}</th>
              <th className="r">{t('summary.person.colTotal')}</th>
              <th>{t('summary.person.colDelivery')}</th>
              <th>{t('summary.person.colNote')}</th>
              <th className="r">
                <span className="sr-only">{t('summary.person.colActions')}</span>
              </th>
            </tr>
          </thead>
          {rows.length === 0 && (
            <tbody>
              <tr>
                <td colSpan={6} className="empty">
                  {t('summary.person.empty')}
                </td>
              </tr>
            </tbody>
          )}
          {groups.map((g, i) => (
            <tbody key={`${i}-${g.name}`}>
              <tr className="sm-group">
                <th colSpan={6} scope="rowgroup">
                  {g.name}
                </th>
              </tr>
              {g.rows.map((row) => (
                <PersonCells key={row.request_id} row={row} ym={ym} locked={locked} stale={stale} onAdjust={onAdjust} />
              ))}
            </tbody>
          ))}
        </table>
      </div>
      {query.hasNextPage && (
        <button
          type="button"
          className="btn admin-more sm-more"
          disabled={query.isFetchingNextPage}
          onClick={() => void query.fetchNextPage()}
        >
          {t('summary.more')}
        </button>
      )}
    </>
  );
}
