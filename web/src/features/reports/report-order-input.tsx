import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { parseOrderQty } from './use-order-qty';

interface Props {
  name: string;
  value: string;
  error: boolean;
  onChange: (text: string) => void;
}

// Ô Đề nghị luôn là ô nhập có viền; lỗi gắn đúng ô (0…99.999)
export function ReportOrderInput({ name, value, error, onChange }: Props) {
  const { t } = useTranslation();
  const errId = useId();
  const invalid = error || parseOrderQty(value) === null;
  return (
    <span className="bc-order">
      <input
        type="number"
        inputMode="numeric"
        min={0}
        autoComplete="off"
        className="bc-order__input"
        value={value}
        aria-label={t('sendAdm.orders.qtyLabel', { name })}
        aria-invalid={invalid ? true : undefined}
        aria-describedby={invalid ? errId : undefined}
        onChange={(e) => onChange(e.target.value)}
        onWheel={(e) => e.currentTarget.blur()}
      />
      {invalid && (
        <small id={errId} className="bc-order__error">
          {t('sendAdm.orders.invalid')}
        </small>
      )}
    </span>
  );
}
