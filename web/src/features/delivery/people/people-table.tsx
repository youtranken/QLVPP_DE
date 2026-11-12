import { createContext, useContext, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { ColumnDef } from '@tanstack/react-table';
import { initialsOf } from '@/lib/initials';
import { DataTable } from '@/ui/data-table';
import { SelectBox } from '@/ui/data-table-row';
import { monthOf } from '@/features/request/request-format';
import type { DeliveryPerson } from './delivery-people.api';
import type { Shortage } from './deliver-plan';
import { cardSummary, isOpenLine } from './people-filter';

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

// Kỳ cũ nhất còn chờ; người đã nhận đủ thì kỳ mới nhất của họ
function periodOf(p: DeliveryPerson): string | null {
  const open = p.lines.filter((l) => l.remaining_qty > 0).map((l) => l.period_ym);
  const all = p.lines.map((l) => l.period_ym);
  return (open.length > 0 ? open.sort() : all.sort().reverse())[0] ?? null;
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

function StatusCell({ person }: { person: DeliveryPerson }) {
  const { t } = useTranslation();
  const { shortages } = useCtx();
  const shortItems = new Set(person.lines.filter((l) => isOpenLine(l) && l.item_id && shortages.has(l.item_id)).map((l) => l.item_id)).size;
  const open = person.lines.filter(isOpenLine);
  const lines = open.length > 0 ? open : person.lines;
  const debt = person.lines.filter((l) => l.is_debt && l.remaining_qty > 0);
  const months = [...new Set(debt.map((l) => monthOf(l.period_ym)))].join(', ');
  const progress = {
    done: lines.reduce((n, l) => n + l.delivered_qty, 0),
    total: lines.reduce((n, l) => n + l.qty - l.cancelled_qty, 0),
  };
  return (
    <span className="pt-status">
      <span className="pt-chips">
        <span className={`pp-chip pp-chip--${person.status}`}>{t(`delivery.people.status.${person.status}`)}</span>
        {shortItems > 0 && <span className="pp-chip pp-chip--short">{t('delivery.people.shortChip', { n: shortItems })}</span>}
      </span>
      {progress.done > 0 && person.status !== 'done' && <small className="pp-card__progress num">{t('delivery.people.card.progress', progress)}</small>}
      {debt.length > 0 && <small className="pt-debt">{t('delivery.people.card.debt', { months, n: debt.length })}</small>}
    </span>
  );
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

function PickCell({ person }: { person: DeliveryPerson }) {
  const { t } = useTranslation();
  const { selected, selectable, onToggle } = useCtx();
  return (
    <SelectBox
      id={pickId(person)}
      checked={selected.has(person.user_sub)}
      disabled={!selectable(person)}
      title={selectable(person) ? undefined : t(person.status === 'done' ? 'delivery.bulk.pickDone' : 'delivery.bulk.pickNoStock')}
      label={t('delivery.bulk.pick', { name: nameOf(person) })}
      onChange={() => onToggle(person.user_sub)}
    />
  );
}

function ActionsCell({ person }: { person: DeliveryPerson }) {
  const { t } = useTranslation();
  const { canDeliver, onView, onDeliver } = useCtx();
  const can = canDeliver(person);
  const label = actionLabel(person, can, t);
  return (
    <span className="pt-acts__in">
      <button type="button" className="btn btn--ghost btn--sm pp-card__view" aria-label={t('delivery.people.card.viewLabel', { name: nameOf(person) })} onClick={() => onView(person.user_sub)}>
        {t('delivery.people.card.view')}
      </button>
      <button type="button" className="btn btn--sm" aria-label={`${label}, ${nameOf(person)}`} disabled={!can} onClick={() => onDeliver(person.user_sub)}>
        {label}
      </button>
    </span>
  );
}

function PeriodCell({ person }: { person: DeliveryPerson }) {
  const { t } = useTranslation();
  const ym = periodOf(person);
  return <>{ym ? t('delivery.people.period', { month: monthOf(ym) }) : t('common.empty')}</>;
}

// Bề rộng cột cố định (DataTable → table--fixed): đổi tab Chưa nhận/Còn nợ/Tất cả thì cột không nhảy theo chữ trong ô.
// Cột Tháng vừa "Tháng 12"/"September" (73px) một dòng cộng đệm 24px; bù phần lớn từ Phòng (vừa "Phòng D&E"/"Department")
// và Thao tác (25.5% vẫn đủ 235px cho hai nút một hàng ở 1280) để cột Người không hẹp thêm.
// Thao tác theo % để ở 1280 đủ "Xem" + "Tủ chưa có hàng" một hàng; ở 1024 hẹp hơn thì nút sau xuống dòng thay vì bảng cuộn ngang
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
            <b>{nameOf(r)}</b>
          </label>
        ),
      },
      { id: 'dept', header: t('delivery.people.cols.dept'), meta: { width: '6.125rem' }, cell: ({ row }) => row.original.department ?? t('delivery.people.card.noDepartment') },
      { id: 'period', header: t('delivery.people.cols.period'), meta: { width: '6.125rem' }, cell: ({ row }) => <PeriodCell person={row.original} /> },
      { id: 'items', header: t('delivery.people.cols.items'), meta: { className: 'num r', width: '4.5rem' }, cell: ({ row }) => t('delivery.people.itemsCount', { n: cardSummary(row.original).n }) },
      { id: 'units', header: t('delivery.people.cols.units'), meta: { className: 'num r', width: '4rem' }, cell: ({ row }) => cardSummary(row.original).u },
      { id: 'status', header: t('delivery.people.cols.status'), meta: { width: '9.5rem' }, cell: ({ row }) => <StatusCell person={row.original} /> },
      { id: 'actions', header: () => <span className="r">{t('delivery.people.cols.actions')}</span>, meta: { className: 'r pt-acts', label: '', width: '25.5%' }, cell: ({ row }) => <ActionsCell person={row.original} /> },
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
