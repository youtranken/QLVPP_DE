import { useState } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useSelectOnFocus } from './use-select-on-focus';

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

// sm: trong bảng / hộp dày (32px máy tính, 44px điện thoại); md: form và khung nhân viên (44px)
export type StepperSize = 'sm' | 'md';

// Một dáng cho mọi ô tăng/giảm số của app: viên nền, nút − / + tròn bên trong, ô số giữa cao bằng cả hàng.
// Logic số (kẹp hay để server quyết, rỗng thì sao) là việc của nơi dùng; khung chỉ lo hình và nút.
export function StepperFrame({
  size = 'md',
  className,
  invalid = false,
  disabled = false,
  decLabel,
  incLabel,
  canDec,
  canInc,
  onStep,
  holdFocus = false,
  noIncrease = false,
  children,
}: {
  size?: StepperSize;
  className?: string;
  invalid?: boolean;
  disabled?: boolean;
  decLabel: string;
  incLabel: string;
  canDec: boolean;
  canInc: boolean;
  onStep: (delta: 1 | -1) => void;
  // Bấm nút không lấy focus khỏi ô số (ô có luật rời ô: trống thì về min, rời ô thì đóng sửa tại chỗ); Tab bỏ qua nút
  holdFocus?: boolean;
  noIncrease?: boolean;
  // Ô số ở giữa
  children: ReactNode;
}) {
  const button = (d: 1 | -1) => (
    <button
      type="button"
      aria-label={d > 0 ? incLabel : decLabel}
      disabled={disabled || !(d > 0 ? canInc : canDec)}
      tabIndex={holdFocus ? -1 : undefined}
      onMouseDown={holdFocus ? (e) => e.preventDefault() : undefined}
      onClick={() => onStep(d)}
    >
      {d > 0 ? '+' : '−'}
    </button>
  );
  const cls = ['stepper', className, invalid ? 'is-invalid' : ''].filter(Boolean).join(' ');
  return (
    <span className={cls} data-size={size} data-dec-only={noIncrease || undefined}>
      {button(-1)}
      {children}
      {!noIncrease && button(1)}
    </span>
  );
}

// Ô giữa gõ được để không phải bấm + hai chục lần; giá trị luôn kẹp trong [min, max]
export function Stepper({
  value,
  min = 0,
  max = Infinity,
  onChange,
  label,
  inputLabel,
  className,
  size = 'md',
  describedBy,
  invalid = false,
  disabled = false,
  onOverMax,
  emptyAsMin = false,
  decreaseOnly = false,
}: {
  value: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
  label: string;
  inputLabel?: string;
  className?: string;
  size?: StepperSize;
  describedBy?: string;
  invalid?: boolean;
  disabled?: boolean;
  // Gõ vượt trần: số bị kẹp về trần, nơi dùng báo "Tối đa n"
  onOverMax?: () => void;
  // Xóa trống ô coi như min thay vì giữ số cũ
  emptyAsMin?: boolean;
  // Chỉ được giảm (Adm D&E sau khóa sổ): không có nút +, gõ số lớn hơn thì kẹp về max
  decreaseOnly?: boolean;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<string | null>(null);
  const selectAll = useSelectOnFocus();
  const set = (n: number) => {
    const next = clamp(n, min, max);
    if (next !== value) onChange(next);
  };
  const type = (text: string) => {
    if (!/^\d*$/.test(text)) return;
    if (text === '') {
      if (emptyAsMin) set(min);
      return setDraft('');
    }
    setDraft(null);
    set(Number(text));
    if (Number(text) > max) onOverMax?.();
  };
  return (
    <StepperFrame
      size={size}
      className={className}
      invalid={invalid}
      disabled={disabled}
      decLabel={t('common.stepper.decrease', { label })}
      incLabel={t('common.stepper.increase', { label })}
      canDec={value > min}
      canInc={value < max}
      noIncrease={decreaseOnly}
      onStep={(d) => set(value + d)}
    >
      <input
        type="number"
        inputMode="numeric"
        className="num"
        aria-label={inputLabel ?? label}
        aria-describedby={describedBy}
        aria-invalid={invalid || undefined}
        min={min}
        max={Number.isFinite(max) ? max : undefined}
        disabled={disabled}
        value={draft ?? value}
        onChange={(e) => type(e.target.value)}
        onFocus={selectAll}
        onBlur={() => setDraft(null)}
      />
    </StepperFrame>
  );
}
