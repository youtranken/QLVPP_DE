import { forwardRef, useCallback, useEffect, useRef, type FocusEvent, type InputHTMLAttributes } from 'react';
import { useTranslation } from 'react-i18next';
import { ADMIN_PHONE_QUERY, useMediaQuery } from '@/lib/use-media-query';
import { Icon } from './icon';

// select() gọi thẳng trong focus bị iOS/Android bỏ (con trỏ đặt sau khi focus xong) → đợi một khung hình
export function useSelectOnFocus() {
  const frame = useRef(0);
  useEffect(() => () => cancelAnimationFrame(frame.current), []);
  return useCallback((e: FocusEvent<HTMLInputElement>) => {
    const el = e.currentTarget;
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      if (document.activeElement === el) el.select();
    });
  }, []);
}

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
  // Nút tăng/giảm: ▲▼ trong viền ô trên máy tính, "− số +" trên điện thoại
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
  const phone = useMediaQuery(ADMIN_PHONE_QUERY);
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
  const button = (d: 1 | -1, children: React.ReactNode) => (
    <button
      type="button"
      tabIndex={-1}
      className={d > 0 ? 'qty-input__up' : 'qty-input__down'}
      aria-label={t(d > 0 ? 'common.stepper.increase' : 'common.stepper.decrease', { label: itemLabel })}
      disabled={d > 0 ? n >= max : n <= min}
      // Giữ focus ở ô: bấm nút không làm ô mất focus (không chạy luật rời ô trống)
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => step(d)}
    >
      {children}
    </button>
  );
  const cls = ['qty-input', wrapClassName, invalid ? 'is-invalid' : ''].filter(Boolean).join(' ');
  if (phone) {
    return (
      <span className={cls} data-layout="stepper">
        {button(-1, '−')}
        {input}
        {button(1, '+')}
      </span>
    );
  }
  return (
    <span className={cls} data-layout="spin">
      {input}
      <span className="qty-input__spin">
        {button(1, <Icon name="chevup" size={14} />)}
        {button(-1, <Icon name="chev" size={14} />)}
      </span>
    </span>
  );
});
