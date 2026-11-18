import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { ColumnDef } from '@tanstack/react-table';
import { formatVnStamp } from '@/lib/format-time';
import { DataTable } from '@/ui/data-table';
import type { ReactNode } from 'react';
import type { AdminUser } from './directory.api';
import { nameOf, type RegFilter } from './users-rows';

// reg: undefined khi chưa tải danh sách đăng ký; null khi người không thuộc danh sách kỳ
export type UserRow = AdminUser & { id: string; reg?: RegFilter | null };

export function StatusBadge({ status }: { status: AdminUser['status'] }) {
  const { t } = useTranslation();
  // Cùng màu với thẻ số ở đầu trang: Đã khóa đỏ, Mất quyền (PMH ID gỡ app) xanh thông tin
  const tone = status === 'active' ? 'tag--ok' : status === 'no_access' ? 'tag--info' : 'tag--danger';
  return <span className={`tag ${tone}`}>{t(`users.status.${status}`)}</span>;
}

export function LastLogin({ iso }: { iso: string | null }) {
  const { t } = useTranslation();
  return iso ? <>{formatVnStamp(iso, true)}</> : <span className="dr-muted">{t('users.page.neverLoggedIn')}</span>;
}

// Chỉ đã/chưa đặt phiếu, không món/số lượng; người ngoài danh sách kỳ (khóa, Hành chính…) ghi "—"
function RegCell({ reg }: { reg: RegFilter | null | undefined }) {
  const { t } = useTranslation();
  if (reg === undefined) return null;
  if (reg === null) return <span className="dr-muted">{t('common.empty')}</span>;
  return <span className={reg === 'yes' ? 'tag tag--ok' : 'tag tag--warn'}>{t(reg === 'yes' ? 'users.reg.cellYes' : 'users.reg.cellNo')}</span>;
}

// Mã NV, nhóm, phòng ban có thể là một chuỗi dài không dấu cách: cắt "…" kèm title thay vì gãy từng mẩu.
// line: mã và nhóm luôn một dòng (gãy ở dấu "-" thành 4 dòng cũng khó đọc như gãy giữa từ)
function Clip({ text, line = false }: { text: string | null | undefined; line?: boolean }) {
  const { t } = useTranslation();
  if (!text) return <>{t('common.empty')}</>;
  return (
    <span className={line ? 'cell-clip cell-clip--line' : 'cell-clip'} title={text}>
      {text}
    </span>
  );
}

// Cột cố định bề rộng (tên nhận phần còn lại): đổi tab/lọc không làm cột nhảy chỗ.
// Cột chỉ phụ thuộc tháng: dữ liệu đăng ký về sau đổi hàng chứ không đổi cột (đổi cột dựng lại bảng, panel đang mở bị đóng)
function useColumns(onOpen: (u: UserRow) => void, regMonth: number | null) {
  const { t } = useTranslation();
  return useMemo<ColumnDef<UserRow, unknown>[]>(() => {
    const columns: ColumnDef<UserRow, unknown>[] = [
        {
          id: 'name',
          header: t('users.page.colName'),
          // Sàn 13rem (208px): ở 768 bảng chạm sàn, tên "Hoàng Nộp Hồ Sơ 1" vẫn một dòng
          meta: { minWidth: '13rem' },
          cell: ({ row: { original: u } }) => (
            <span className="dr-person">
              <span className="dr-person__text">
                <button
                  type="button"
                  className="dr-person__name"
                  onClick={(e) => {
                    // Dòng cũng mở panel: không để cú bấm nổi lên mở lần hai (thêm một mục lịch sử)
                    e.stopPropagation();
                    onOpen(u);
                  }}
                >
                  {nameOf(u)}
                </button>
                {u.email && (
                  <small
                    className="dr-muted dr-person__email cell-clip cell-clip--line"
                    title={u.email}
                    // Vừa bôi đen email để chép thì cú bấm đó không mở panel (dòng có onRowClick)
                    onClick={(e) => {
                      if (window.getSelection()?.toString()) e.stopPropagation();
                    }}
                  >
                    {u.email}
                  </small>
                )}
              </span>
            </span>
          ),
        },
        { id: 'code', header: t('users.page.colCode'), meta: { width: '5.5rem' }, cell: ({ row }) => <Clip text={row.original.employeeCode} line /> },
        { id: 'department', header: t('users.page.colDepartment'), meta: { width: '6.5rem' }, cell: ({ row }) => <Clip text={row.original.department} /> },
        // Ở 1024 bảng chỉ rộng 54rem nên mỗi px cột khác lấy từ cột Họ tên; tiêu đề "Phiếu tháng 11" xuống hai dòng được, ô chỉ cần vừa "Chưa đặt"
        ...(regMonth === null ? [] : [{ id: 'reg', header: t('users.reg.col', { month: regMonth }), meta: { width: '6.75rem' }, cell: ({ row }: { row: { original: UserRow } }) => <RegCell reg={row.original.reg} /> }]),
        { id: 'team', header: t('users.page.colTeam'), meta: { width: '5.25rem' }, cell: ({ row }) => <Clip text={row.original.team} line /> },
        {
          id: 'status',
          header: t('users.page.colStatus'),
          meta: { width: '8rem' },
          cell: ({ row }) => (
            <span className="dr-status">
              <StatusBadge status={row.original.status} />
              {row.original.role === 'admin' && <span className="tag tag--outline">{t('users.page.adminTag')}</span>}
            </span>
          ),
        },
        { id: 'lastLogin', header: t('users.page.colLastLogin'), meta: { width: '9rem' }, cell: ({ row }) => <LastLogin iso={row.original.lastLoginAt} /> },
    ];
    return columns.map((c) => ({ ...c, enableSorting: false }));
  }, [t, onOpen, regMonth]);
}

export function UsersTable({
  rows,
  loading,
  activeId,
  empty,
  onOpen,
  regMonth,
}: {
  regMonth: number | null;
  rows: UserRow[];
  loading: boolean;
  activeId?: string;
  empty: { title: string; hint?: string; action: ReactNode };
  onOpen: (u: UserRow) => void;
}) {
  const columns = useColumns(onOpen, regMonth);
  return (
    <DataTable
      data={rows}
      columns={columns}
      loading={loading}
      emptyText={empty.title}
      empty={{ variant: 'no-match', hint: empty.hint, action: empty.action }}
      activeRowId={activeId}
      onRowClick={onOpen}
      rowClassName={(u) => (u.status !== 'active' ? 'is-inactive' : '')}
      stackOnMobile
      tableClassName="dr-table table--cards"
    />
  );
}
