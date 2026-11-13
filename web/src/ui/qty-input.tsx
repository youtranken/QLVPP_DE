import { forwardRef, type InputHTMLAttributes } from 'react';
import { useTranslation } from 'react-i18next';
import { StepperFrame } from './stepper';
import { useSelectOnFocus } from './use-select-on-focus';

type NativeProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type' | 'min' | 'max'>;

interface Props extends NativeProps {
  value: string;
  onChange: (text: string) => void;
  // aria-label của ô
  label: string;
  // Tên món cho nhãn nút tăng/giảm
  name?: string;
  min?: number;
  max: number;
  // Có nút − / +: dùng khung Stepper chung (cỡ sm), như mọi ô tăng/giảm khác của app
  steppers?: boolean;
  invalid?: boolean;
  wrapClassName?: string;
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

// Ô số dùng chung: tô hết số khi bấm vào, rời ô mà trống thì về số nhỏ nhất (không báo lỗi)
export const QtyInput = forwardRef<HTMLInputElement, Props>(function QtyInput(
  { value, onChange, label, name, min = 0, max, steppers = false, invalid = false, wrapClassName, className, onFocus, onBlur, ...rest },
  ref,
) {
  const { t } = useTranslation();
  const selectAll = useSelectOnFocus();
  const n = /^\d+$/.test(value.trim()) ? Number(value.trim()) : min;
  const step = (d: number) => onChange(String(clamp(n + d, min, max)));
  const input = (
    <input
      {...rest}
      ref={ref}
      type="number"
      inputMode="numeric"
      min={min}
      max={max}
      autoComplete="off"
      className={className}
      value={value}
      aria-label={label}
      aria-invalid={invalid || undefined}
      onChange={(e) => onChange(e.target.value)}
      onFocus={(e) => {
        selectAll(e);
        onFocus?.(e);
      }}
      onBlur={(e) => {
        if (value.trim() === '') onChange(String(min));
        onBlur?.(e);
      }}
      onWheel={(e) => e.currentTarget.blur()}
    />
  );
  if (!steppers) return input;
  const itemLabel = name ?? label;
  return (
    <StepperFrame
      size="sm"
      className={wrapClassName}
      invalid={invalid}
      decLabel={t('common.stepper.decrease', { label: itemLabel })}
      incLabel={t('common.stepper.increase', { label: itemLabel })}
      canDec={n > min}
      canInc={n < max}
      // Giữ focus ở ô: bấm nút không làm ô mất focus (không chạy luật rời ô trống)
      holdFocus
      onStep={step}
    >
      {input}
    </StepperFrame>
  );
});
