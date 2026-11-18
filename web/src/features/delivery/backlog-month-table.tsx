import { useTranslation } from 'react-i18next';
import { ADMIN_PHONE_QUERY, useMediaQuery } from '@/lib/use-media-query';
import { Icon } from '@/ui/icon';
import { RowMenu } from '@/ui/row-menu';
import type { BacklogLine } from './backlog.api';
import { useBacklogFormat } from './backlog-format';
import { isLeft, type BacklogMonth, type BacklogPerson } from './backlog-months';

export type LineAction = 'deliver' | 'cancel' | 'history';
type OnAction = (action: LineAction, line: BacklogLine) => void;

const COLUMNS = ['item', 'unit', 'qty', 'delivered', 'owed', 'stock', 'actions'] as const;

function Actions({ line, phone, onAction }: { line: BacklogLine; phone: boolean; onAction: OnAction }) {
  const { t } = useTranslation();
  const f = useBacklogFormat();
  const who = { name: f.name(line), person: f.person(line) };
  const label = t('delivery.backlog.historyOf', who);
  const out = line.stock_qty === 0;
  const cancel = { label: t('delivery.backlog.cancel'), danger: true, onSelect: () => onAction('cancel', line) };
  return (
    <span className="bl-acts">
      {out && <span className="tag">{t('delivery.backlog.outOfStock')}</span>}
      <button type="button" className="btn btn--sm bl-deliver" disabled={out} title={out ? t('delivery.backlog.deliverOut') : undefined} onClick={() => onAction('deliver', line)}>
        {t('delivery.backlog.deliverMore')}
      </button>
      {phone ? (
        <RowMenu label={t('delivery.backlog.moreOf', who)} items={[cancel, { label: t('delivery.backlog.history'), onSelect: () => onAction('history', line) }]} />
      ) : (
        <>
          <button type="button" className="btn btn--sm btn--ghost bl-icon-btn" aria-label={label} title={label} onClick={() => onAction('history', line)}>
            <Icon name="history" size={18} />
          </button>
          {/* Chỉ một thao tác phụ: nút chữ thấy ngay, không giấu sau menu ⋯ một mục */}
          <button type="button" className="btn btn--sm btn--danger-line bl-cancel" aria-label={t('delivery.backlog.cancelOf', who)} onClick={() => onAction('cancel', line)}>
            {t('delivery.backlog.cancel')}
          </button>
        </>
      )}
    </span>
  );
}

function LineRow({ line, phone, onAction }: { line: BacklogLine; phone: boolean; onAction: OnAction }) {
  const { t } = useTranslation();
  const f = useBacklogFormat();
  return (
    <tr>
      <td className="bl-item" data-label={t('delivery.backlog.cols.item')}>
        <b>{f.name(line)}</b>
      </td>
      <td data-label={t('delivery.backlog.cols.unit')}>{f.unit(line.unit)}</td>
      <td className="num r" data-label={t('delivery.backlog.cols.qty')}>{line.qty}</td>
      <td className="num r" data-label={t('delivery.backlog.cols.delivered')}>{line.delivered_qty}</td>
      <td className="num r bl-owed" data-label={t('delivery.backlog.cols.owed')}>
        <b>{line.remaining_qty}</b>
      </td>
      <td className="num r" data-label={t('delivery.backlog.cols.stock')}>{line.stock_qty === null ? '—' : line.stock_qty}</td>
      <td className="r bl-cell-acts">
        <Actions line={line} phone={phone} onAction={onAction} />
      </td>
    </tr>
  );
}

function PersonRows({ person, phone, onAction }: { person: BacklogPerson; phone: boolean; onAction: OnAction }) {
  const { t } = useTranslation();
  const f = useBacklogFormat();
  const name = f.person(person);
  return (
    <>
      <tr className="bl-person">
        <th scope="row" colSpan={COLUMNS.length}>
          <span className="bl-head">
            <b>{name}</b>
            <small>{person.department ?? t('delivery.noDepartment')}</small>
            {isLeft(person) && <span className="tag tag--outline">{t('delivery.backlog.left')}</span>}
          </span>
        </th>
      </tr>
      {person.lines.map((l) => (
        <LineRow key={l.line_id} line={l} phone={phone} onAction={onAction} />
      ))}
    </>
  );
}

export function BacklogMonthTable({ months, onAction }: { months: BacklogMonth[]; onAction: OnAction }) {
  const { t } = useTranslation();
  const f = useBacklogFormat();
  const phone = useMediaQuery(ADMIN_PHONE_QUERY);
  return (
    <div className="table-wrap">
      <table className="table table-stack grid-table bl-table" aria-label={t('delivery.backlog.tableLabel')}>
        <thead>
          <tr>
            {COLUMNS.map((c) => (
              <th key={c} scope="col" className={['qty', 'delivered', 'owed', 'stock'].includes(c) ? 'num r' : undefined}>
                {t(`delivery.backlog.cols.${c}`)}
              </th>
            ))}
          </tr>
        </thead>
        {months.map((m) => (
          <tbody key={m.ym}>
            {/* Một tháng thì dòng tóm tắt đã nằm trên thanh công cụ; nhiều tháng mới cần dải tháng ngăn từng nhóm */}
            {months.length > 1 && (
            <tr className="dt-group">
              <th scope="rowgroup" colSpan={COLUMNS.length}>
                {t('delivery.backlog.monthHead', { month: f.month(m.ym), people: t('common.count.people', { count: m.people.length }), units: t('common.count.units', { count: m.owed_units }) })}
              </th>
            </tr>
            )}
            {m.people.map((p) => (
              <PersonRows key={p.user_sub} person={p} phone={phone} onAction={onAction} />
            ))}
          </tbody>
        ))}
      </table>
    </div>
  );
}
