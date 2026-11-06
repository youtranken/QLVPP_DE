import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ItemThumb } from '@/ui/item-thumb';
import { Stepper } from '@/ui/stepper';
import { monthOf, useRequestFormat } from '@/features/request/request-format';
import type { DeliveryPersonLine } from './delivery-people.api';
import type { DialogRow, Limit, Shortage } from './deliver-plan';
import type { Waiting } from './people-filter';

export interface RowsProps {
  rows: DialogRow[];
  limits: Record<string, Limit>;
  disabled: boolean;
  waiting: (line: DeliveryPersonLine) => Waiting;
  shortage: (line: DeliveryPersonLine) => Shortage | undefined;
  onChange: (lineId: string, n: number) => void;
}

function Meta({ row, waiting, shortage }: { row: DialogRow } & Pick<RowsProps, 'waiting' | 'shortage'>) {
  const { t } = useTranslation();
  const l = row.line;
  const w = waiting(l);
  const short = shortage(l);
  const info =
    l.stock_qty === null
      ? t('delivery.people.panel.needNoStock', { n: l.remaining_qty })
      : w.people > 0
        ? t('delivery.people.panel.lineInfo', { need: l.remaining_qty, stock: l.stock_qty, k: w.people, q: w.qty })
        : t('delivery.people.panel.need', { n: l.remaining_qty, stock: l.stock_qty });
  return (
    <>
      <small>{info}</small>
      {short && <small className="dd-warn">{t('warn.W19row', { ...short })}</small>}
      {row.held && <small className="dd-held">{t('delivery.confirm.reserved', row.held)}</small>}
    </>
  );
}

function LineRow({ row, limit, disabled, waiting, shortage, onChange }: { row: DialogRow; limit: Limit } & Omit<RowsProps, 'rows' | 'limits'>) {
  const { t } = useTranslation();
  const fmt = useRequestFormat();
  const [over, setOver] = useState(false);
  const l = row.line;
  const name = fmt.name(l);
  const rest = l.remaining_qty - limit.value;
  const tag = row.kind === 'give' && rest > 0 ? t(l.is_debt ? 'delivery.confirm.oweTag' : 'delivery.confirm.leftTag', { n: rest }) : null;
  return (
    <tr>
      <td className="dd-item">
        <ItemThumb fileId={l.image_file_id} alt="" tone="g0" size={42} />
        <span className="dd-item__text">
          <b>{name}</b>
          {l.is_debt && <span className="dd-debt">{t('delivery.confirm.debtTag', { month: monthOf(l.period_ym) })}</span>}
          <Meta row={row} waiting={waiting} shortage={shortage} />
          {row.kind === 'adm' && <small className="dd-warn">{t('delivery.confirm.admLine', { s: row.stockLeft, n: rest })}</small>}
        </span>
      </td>
      <td className="num">{l.remaining_qty}</td>
      <td>
        {limit.cap > 0 ? (
          <Stepper
            className="dd-step"
            value={limit.value}
            min={0}
            max={limit.cap}
            disabled={disabled}
            emptyAsMin
            label={t('delivery.confirm.qty', { name })}
            onOverMax={() => setOver(true)}
            onChange={(n) => {
              setOver(false);
              onChange(l.line_id, n);
            }}
          />
        ) : (
          <span className="dd-none">{t(limit.taken ? 'delivery.people.panel.allocatedAbove' : 'delivery.people.panel.outOfStock')}</span>
        )}
        {over && <small className="dd-max">{t('delivery.confirm.max', { n: limit.cap })}</small>}
      </td>
      <td>{tag && <span className="dd-left">{tag}</span>}</td>
    </tr>
  );
}

function Head({ hidden = false }: { hidden?: boolean }) {
  const { t } = useTranslation();
  return (
    <thead className={hidden ? 'sr-only' : undefined}>
      <tr>
        <th scope="col">{t('delivery.confirm.cols.item')}</th>
        <th scope="col" className="num">
          {t('delivery.confirm.cols.need')}
        </th>
        <th scope="col">{t('delivery.confirm.cols.now')}</th>
        <th scope="col">{t('delivery.confirm.cols.left')}</th>
      </tr>
    </thead>
  );
}

function Table({ rows, limits, hiddenHead, ...rest }: RowsProps & { hiddenHead?: boolean }) {
  return (
    <table className="dd-table">
      <Head hidden={hiddenHead} />
      <tbody>
        {rows.map((r) => (
          <LineRow key={r.line.line_id} row={r} limit={limits[r.line.line_id]} {...rest} />
        ))}
      </tbody>
    </table>
  );
}

// Nhóm hàng giao, nhóm ADM hết hàng (giao từ tủ, hủy phần thiếu) và nhóm không giao lần này
export function DeliverRows(props: RowsProps) {
  const { t } = useTranslation();
  const fmt = useRequestFormat();
  const give = props.rows.filter((r) => r.kind === 'give');
  const adm = props.rows.filter((r) => r.kind === 'adm');
  const skip = props.rows.filter((r) => r.kind === 'skip');
  const noStock = give.length === 0 && skip.some((r) => r.reason === 'stock');
  return (
    <div className="dd-rows">
      {noStock ? <p className="dd-nostock">{t('delivery.confirm.noStock')}</p> : give.length > 0 && <Table {...props} rows={give} />}
      {adm.length > 0 && (
        <section className="dd-group dd-group--adm">
          <h3>{t('delivery.confirm.admOut')}</h3>
          <Table {...props} rows={adm} hiddenHead={give.length > 0} />
        </section>
      )}
      {skip.length > 0 && !noStock && (
        <section className="dd-group dd-group--skip">
          <h3>{t('delivery.confirm.skipped')}</h3>
          <ul>
            {skip.map((r) => (
              <li key={r.line.line_id}>
                <b>{fmt.name(r.line)}</b>
                <span>{t(r.reason === 'review' ? 'delivery.people.panel.pendingReview' : 'delivery.people.panel.outOfStock')}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
