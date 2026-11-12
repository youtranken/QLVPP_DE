import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ItemThumb } from '@/ui/item-thumb';
import { Stepper } from '@/ui/stepper';
import { monthOf, useRequestFormat } from '@/features/request/request-format';
import type { DeliveryPersonLine } from './delivery-people.api';
import { isDeliverable, isNotReceived, type DialogRow, type Limit, type Shortage } from './deliver-plan';
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

// Phần NCC hết hàng không giao: chỉ cụm "Không giao n" tô đỏ, lý do đi kèm màu thường
function NoGive({ n }: { n: number }) {
  const { t } = useTranslation();
  return (
    <span className="dd-nogive">
      <b>{t('delivery.confirm.noGive', { n })}</b> {t('delivery.confirm.noGiveWhy')}
    </span>
  );
}

// Cột "Còn lại sau lần này": dòng giao còn thiếu ghi Chưa nhận/Nợ; dòng NCC hết hàng có giao một phần ghi phần không giao
function leftOf(row: DialogRow, limit: Limit, t: (k: string, o?: Record<string, unknown>) => string): ReactNode {
  const rest = row.line.remaining_qty - limit.value;
  if (rest <= 0) return null;
  if (row.kind === 'give') return <span className="dd-left">{t(row.line.is_debt ? 'delivery.confirm.oweTag' : 'delivery.confirm.leftTag', { n: rest })}</span>;
  if (row.kind === 'adm' && limit.cap > 0) return <NoGive n={rest} />;
  return null;
}

function LineRow({ row, limit, disabled, waiting, shortage, showLeft, onChange }: { row: DialogRow; limit: Limit; showLeft: boolean } & Omit<RowsProps, 'rows' | 'limits'>) {
  const { t } = useTranslation();
  const fmt = useRequestFormat();
  const [over, setOver] = useState(false);
  const l = row.line;
  const name = fmt.name(l);
  // NCC hết hàng mà tủ không còn: không có ô số, câu "Không giao n" chiếm luôn cột còn lại
  const noStockAdm = row.kind === 'adm' && limit.cap === 0;
  const notReceived = isNotReceived(row);
  return (
    <tr className={notReceived ? 'dd-row--off' : undefined}>
      <td className="dd-item">
        <ItemThumb fileId={l.image_file_id} alt="" tone="g0" size={42} />
        <span className="dd-item__text">
          <b>{name}</b>
          {l.is_debt && <span className="dd-debt">{t('delivery.confirm.debtTag', { month: monthOf(l.period_ym) })}</span>}
          <Meta row={row} waiting={waiting} shortage={shortage} />
        </span>
      </td>
      <td className="num">{l.remaining_qty}</td>
      {noStockAdm ? (
        <td colSpan={showLeft ? 2 : 1}>
          <NoGive n={l.remaining_qty} />
        </td>
      ) : (
        <>
          <td>
            {limit.cap > 0 ? (
              <Stepper
                size="sm"
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
              <span className="dd-none">{t(notReceived ? 'delivery.people.panel.notReceived' : limit.taken ? 'delivery.people.panel.allocatedAbove' : 'delivery.people.panel.outOfStock')}</span>
            )}
            {over && <small className="dd-max">{t('delivery.confirm.max', { n: limit.cap })}</small>}
          </td>
          {showLeft && <td>{leftOf(row, limit, t)}</td>}
        </>
      )}
    </tr>
  );
}

function Head({ hidden = false, showLeft }: { hidden?: boolean; showLeft: boolean }) {
  const { t } = useTranslation();
  return (
    <thead className={hidden ? 'sr-only' : undefined}>
      <tr>
        <th scope="col">{t('delivery.confirm.cols.item')}</th>
        <th scope="col" className="num">
          {t('delivery.confirm.cols.need')}
        </th>
        <th scope="col">{t('delivery.confirm.cols.now')}</th>
        {showLeft && <th scope="col">{t('delivery.confirm.cols.left')}</th>}
      </tr>
    </thead>
  );
}

// Bảng hàng giao và bảng NCC hết hàng dùng chung cột để số thẳng hàng
function Table({ rows, limits, hiddenHead, showLeft, ...rest }: RowsProps & { hiddenHead?: boolean; showLeft: boolean }) {
  return (
    <table className={showLeft ? 'dd-table' : 'dd-table dd-table--noleft'}>
      <colgroup>
        <col />
        <col className="dd-col-need" />
        <col className="dd-col-now" />
        {showLeft && <col className="dd-col-left" />}
      </colgroup>
      <Head hidden={hiddenHead} showLeft={showLeft} />
      <tbody>
        {rows.map((r) => (
          <LineRow key={r.line.line_id} row={r} limit={limits[r.line.line_id]} showLeft={showLeft} {...rest} />
        ))}
      </tbody>
    </table>
  );
}

// Nhóm hàng giao, nhóm NCC hết hàng (giao phần tủ có, phần thiếu hủy) và nhóm không giao lần này
export function DeliverRows(props: RowsProps) {
  const { t } = useTranslation();
  const fmt = useRequestFormat();
  const give = props.rows.filter((r) => r.kind === 'give');
  const adm = props.rows.filter((r) => r.kind === 'adm');
  // Cột "Còn lại sau lần này" chỉ ẩn khi mọi dòng của cả hai bảng đều trống
  const showLeft = [...give, ...adm].some((r) => leftOf(r, props.limits[r.line.line_id], t) !== null);
  const skip = props.rows.filter((r) => r.kind === 'skip');
  const waiting = give.filter(isNotReceived);
  // Không dòng nào giao được (tủ trống, món ngoài DM chưa về): một câu thay bảng, món chưa về vẫn liệt kê bên dưới để theo dõi
  const noStock = !give.some(isDeliverable) && (waiting.length > 0 || skip.some((r) => r.reason === 'stock'));
  // Tủ trống thay cả danh sách thiếu hàng bằng một câu; dòng chờ duyệt vẫn phải hiện
  const skipShown = noStock ? skip.filter((r) => r.reason === 'review') : skip;
  return (
    <div className="dd-rows">
      {noStock ? (
        <>
          <p className="dd-nostock">{t('delivery.confirm.noStock')}</p>
          {waiting.length > 0 && <Table {...props} rows={waiting} showLeft={showLeft} />}
        </>
      ) : (
        give.length > 0 && <Table {...props} rows={give} showLeft={showLeft} />
      )}
      {adm.length > 0 && (
        <section className="dd-group dd-group--adm">
          <h3>{t('delivery.confirm.admOut')}</h3>
          <Table {...props} rows={adm} hiddenHead={give.length > 0} showLeft={showLeft} />
        </section>
      )}
      {skipShown.length > 0 && (
        <section className="dd-group dd-group--skip">
          <h3>{t('delivery.confirm.skipped')}</h3>
          <ul>
            {skipShown.map((r) => (
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
