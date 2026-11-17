import { createContext, useContext, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { ColumnDef } from '@tanstack/react-table';
import { initialsOf } from '@/lib/initials';
import { DataTable } from '@/ui/data-table';
import { SelectBox } from '@/ui/data-table-row';
import { Progress } from '@/ui/progress';
import { RowMenu } from '@/ui/row-menu';
import { EmptyValue } from '@/ui/empty-cell';
import type { DeliveryPerson } from './delivery-people.api';
import type { Shortage } from './deliver-plan';
import { isOpenLine } from './people-filter';

export function PersonAvatar({ name, large = false }: { name: string; large?: boolean }) {
  return (
    <span className={`pp-avatar${large ? ' pp-avatar--lg' : ''}`} aria-hidden="true">
      {initialsOf(name)}
    </span>
  );
}

// Bật: "Giao…" (có bước xác nhận); vô hiệu thì nói lý do
function actionLabel(person: DeliveryPerson, canDeliver: boolean, t: (k: string) => string) {
  if (canDeliver) return t('delivery.people.card.action');
  if (person.status === 'done') return t('delivery.people.card.delivered');
  if (!person.lines.some(isOpenLine)) return t('delivery.people.card.waitingReview');
  return t('delivery.people.card.noStock');
}

interface Props {
  rows: DeliveryPerson[];
  shortages: ReadonlyMap<string, Shortage>;
  selected: ReadonlySet<string>;
  selectable: (p: DeliveryPerson) => boolean;
  canDeliver: (p: DeliveryPerson) => boolean;
  activeId?: string;
  onToggle: (sub: string) => void;
  onToggleAll: (checked: boolean) => void;
  onView: (sub: string) => void;
  onDeliver: (sub: string) => void;
  onHistory: (sub: string) => void;
}

// Cột giữ nguyên giữa các lần vẽ (TanStack coi mỗi hàm cell mới là component mới và dựng lại ô, mất tiêu điểm);
// trạng thái đổi theo lần vẽ đi qua context
const Ctx = createContext<Props | null>(null);
const useCtx = () => {
  const v = useContext(Ctx);
  if (!v) throw new Error('PeopleTable context');
  return v;
};
const nameOf = (r: DeliveryPerson) => r.full_name ?? r.user_sub;
// Ô chọn và tên người nối bằng label: điện thoại bấm cả tên cũng chọn (vùng bấm đủ 44px)
const pickId = (r: DeliveryPerson) => `pt-pick-${encodeURIComponent(r.user_sub)}`;

// Mọi dòng (tháng đang giao + nợ): đã giao trên phần còn phải giao (đã hủy ra khỏi mẫu số)
function ProgressCell({ person }: { person: DeliveryPerson }) {
  const { t } = useTranslation();
  const done = person.lines.reduce((n, l) => n + l.delivered_qty, 0);
  const total = person.lines.reduce((n, l) => n + l.qty - l.cancelled_qty, 0);
  if (total === 0) return <EmptyValue />;
  return (
    <span className="pt-progress">
      <Progress done={done} total={total} label={t('delivery.people.progressLabel', { done, total })} text={`${done}/${total}`} />
    </span>
  );
}

function StockCell({ person }: { person: DeliveryPerson }) {
  const { t } = useTranslation();
  const { shortages } = useCtx();
  const open = person.lines.filter(isOpenLine);
  if (open.length === 0) return <EmptyValue />;
  const names = [...new Set(open.filter((l) => l.item_id && shortages.has(l.item_id)).map((l) => l.name))];
  if (names.length === 0) return <span className="tag tag--ok">{t('delivery.people.stockOk')}</span>;
  const text = t('delivery.people.stockShort', { names: names.join(', ') });
  return (
    <span className="tag tag--warn pt-short" title={text}>
      {text}
    </span>
  );
}

function DebtCell({ person }: { person: DeliveryPerson }) {
  const { t } = useTranslation();
  const debt = person.lines.filter((l) => l.is_debt && l.remaining_qty > 0);
  if (debt.length === 0) return <EmptyValue />;
  const months = [...new Set(debt.map((l) => l.period_ym))].sort().map((ym) => t('delivery.people.monthShort', { month: Number(ym.slice(5)) }));
  return <span className="num">{t('delivery.people.debtValue', { n: debt.length, months: months.join(', ') })}</span>;
}

function PickHeader() {
  const { t } = useTranslation();
  const { rows, selected, selectable, onToggleAll } = useCtx();
  const pickable = rows.filter(selectable);
  const all = pickable.length > 0 && pickable.every((r) => selected.has(r.user_sub));
  const some = pickable.some((r) => selected.has(r.user_sub));
  // Không dòng nào chọn được (tủ chưa có hàng / đã giao xong) thì "Chọn tất cả" cũng khóa, kèm lý do
  const none = pickable.length === 0;
  return (
    <SelectBox
      checked={all}
      indeterminate={some && !all}
      disabled={none}
      title={none ? t('delivery.bulk.pickAllNone') : undefined}
      label={t('delivery.bulk.pickAll')}
      onChange={onToggleAll}
    />
  );
}

// Người đã nghỉ không được chia hàng ưu tiên (gợi ý 0) nên không vào giao nhiều phiếu — nói đúng lý do đó, không phải "tủ chưa có hàng"
const pickBlockedKey = (p: DeliveryPerson) =>
  p.status === 'done' ? 'delivery.bulk.pickDone' : p.user_status !== 'active' ? 'delivery.bulk.pickLeft' : 'delivery.bulk.pickNoStock';

function PickCell({ person }: { person: DeliveryPerson }) {
  const { t } = useTranslation();
  const { selected, selectable, onToggle } = useCtx();
  return (
    <SelectBox
      id={pickId(person)}
      checked={selected.has(person.user_sub)}
      disabled={!selectable(person)}
      title={selectable(person) ? undefined : t(pickBlockedKey(person))}
      label={t('delivery.bulk.pick', { name: nameOf(person) })}
      onChange={() => onToggle(person.user_sub)}
    />
  );
}

function ActionsCell({ person }: { person: DeliveryPerson }) {
  const { t } = useTranslation();
  const { canDeliver, onView, onDeliver, onHistory } = useCtx();
  const can = canDeliver(person);
  const label = actionLabel(person, can, t);
  return (
    <span className="pt-acts__in">
      <button type="button" className="btn btn--sm" aria-label={`${label}, ${nameOf(person)}`} disabled={!can} onClick={() => onDeliver(person.user_sub)}>
        {label}
      </button>
      <RowMenu
        label={t('delivery.people.more', { name: nameOf(person) })}
        items={[
          { label: t('delivery.people.viewDetail'), onSelect: () => onView(person.user_sub) },
          { label: t('summary.history.open'), onSelect: () => onHistory(person.user_sub) },
        ]}
      />
    </span>
  );
}

// Bề rộng cột cố định (DataTable → table--fixed): đổi tab Chưa nhận/Còn nợ/Tất cả thì cột không nhảy theo chữ trong ô
function useColumns() {
  const { t } = useTranslation();
  return useMemo<ColumnDef<DeliveryPerson, unknown>[]>(() => {
    const cols: ColumnDef<DeliveryPerson, unknown>[] = [
      { id: 'pick', header: () => <PickHeader />, meta: { className: 'pt-pick', label: '', width: '2.75rem' }, cell: ({ row }) => <PickCell person={row.original} /> },
      {
        id: 'person',
        header: t('delivery.people.cols.person'),
        cell: ({ row: { original: r } }) => (
          <label className="pt-person" htmlFor={pickId(r)}>
            <PersonAvatar name={nameOf(r)} />
            <span className="pt-person__text">
              <b>{nameOf(r)}</b>
              <small>{r.department ?? t('delivery.people.card.noDepartment')}</small>
            </span>
          </label>
        ),
      },
      { id: 'progress', header: t('delivery.people.cols.progress'), meta: { width: '11rem' }, cell: ({ row }) => <ProgressCell person={row.original} /> },
      { id: 'stock', header: t('delivery.people.cols.stock'), meta: { width: '10rem' }, cell: ({ row }) => <StockCell person={row.original} /> },
      { id: 'debt', header: t('delivery.people.cols.debt'), meta: { width: '8rem' }, cell: ({ row }) => <DebtCell person={row.original} /> },
      { id: 'actions', header: () => <span className="r">{t('delivery.people.cols.actions')}</span>, meta: { className: 'r pt-acts', label: '', width: '12rem' }, cell: ({ row }) => <ActionsCell person={row.original} /> },
    ];
    return cols.map((c) => ({ ...c, enableSorting: false }));
  }, [t]);
}

export function PeopleTable(props: Props) {
  const { t } = useTranslation();
  const columns = useColumns();
  const data = useMemo(() => props.rows.map((r) => ({ ...r, id: r.user_sub })), [props.rows]);
  return (
    <Ctx.Provider value={props}>
      <DataTable
        data={data}
        columns={columns}
        stackOnMobile
        emptyText={t('delivery.people.empty')}
        activeRowId={props.activeId}
        rowClassName={(r) => (props.selected.has(r.user_sub) ? 'is-picked' : '')}
        tableClassName="grid-table pt-table"
      />
    </Ctx.Provider>
  );
}
