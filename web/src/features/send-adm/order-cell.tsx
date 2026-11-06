import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DiffNote } from '@/ui/feedback/diff-note';
import { useRequestFormat } from '@/features/request/request-format';
import { parseOrderQty } from '@/features/reports/use-order-qty';
import { orderDiff, useFormulaText } from './order-formula';
import type { OrderRow } from './send-adm-rows';

interface Props {
  row: OrderRow;
  value: string;
  error?: boolean;
  onEdit: (text: string) => void;
  onReset: () => void;
}

// Số đậm chỉ đọc; "Sửa số" mới mở ô nhập (không mũi tên, con lăn không đổi số)
export function OrderCell({ row, value, error = false, onEdit, onReset }: Props) {
  const { t } = useTranslation();
  const fmt = useRequestFormat();
  const formula = useFormulaText();
  const errId = useId();
  const parsed = parseOrderQty(value);
  const [editing, setEditing] = useState(false);
  const order = parsed ?? row.suggested;
  const edited = parsed !== null && parsed !== row.suggested;
  const reset = () => {
    setEditing(false);
    onReset();
  };
  const invalid = error || parsed === null;
  const open = editing || invalid;
  return (
    <div className="sa-order">
      <div className="sa-order__line">
        {open ? (
          <input
            type="number"
            inputMode="numeric"
            min={0}
            autoComplete="off"
            autoFocus
            value={value}
            aria-label={t('sendAdm.orders.qtyLabel', { name: fmt.name(row) })}
            aria-invalid={invalid ? true : undefined}
            aria-describedby={invalid ? errId : undefined}
            onChange={(e) => onEdit(e.target.value)}
            onWheel={(e) => e.currentTarget.blur()}
          />
        ) : (
          <b className="sa-order__n">{order}</b>
        )}
        {!open && (
          <button type="button" className="sa-link" onClick={() => setEditing(true)}>
            {t('sendAdm.order.edit')}
          </button>
        )}
        {(open || edited) && (
          <button type="button" className="sa-link" onClick={reset}>
            {t('sendAdm.order.reset')}
          </button>
        )}
      </div>
      {invalid && (
        <small id={errId} className="sa-err">
          {t('sendAdm.orders.invalid')}
        </small>
      )}
      {edited && <span className="tag tag--warn sa-order__edited">{t('sendAdm.order.edited', { x: parsed, y: row.suggested })}</span>}
      <small className="sa-formula">{formula(row)}</small>
      <DiffNote d={orderDiff(row, order)} order={order} unit={fmt.unit(row.unit)} />
    </div>
  );
}
