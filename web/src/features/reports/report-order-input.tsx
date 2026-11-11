import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { QtyInput } from '@/ui/qty-input';
import { ORDER_QTY_MAX } from './reports.api';
import type { OrderError } from './use-order-qty';

interface Props {
  name: string;
  value: string;
  error: OrderError | null;
  // Số hệ thống vượt trần, người dùng chưa gõ: ghi chú vàng, không chặn
  overMax?: boolean;
  onChange: (text: string) => void;
}

// Ô Đề nghị: ▲▼ trong ô (điện thoại "− số +"), lỗi gắn đúng ô (0…1.000)
export function ReportOrderInput({ name, value, error, overMax = false, onChange }: Props) {
  const { t } = useTranslation();
  const noteId = useId();
  const noted = !!error || overMax;
  return (
    <span className="bc-order">
      <QtyInput
        className="bc-order__input"
        wrapClassName="bc-order__box"
        value={value}
        label={t('sendAdm.orders.qtyLabel', { name })}
        name={name}
        max={ORDER_QTY_MAX}
        steppers
        invalid={!!error}
        aria-describedby={noted ? noteId : undefined}
        onChange={onChange}
      />
      {error && (
        <small id={noteId} className="bc-order__error">
          {t(error === 'sent' ? 'sendAdm.orders.invalidSent' : 'sendAdm.orders.invalid')}
        </small>
      )}
      {!error && overMax && (
        <small id={noteId} className="bc-order__over">
          {t('sendAdm.orders.overMax')}
        </small>
      )}
    </span>
  );
}
