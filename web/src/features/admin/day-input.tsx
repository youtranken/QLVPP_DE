import { FormField } from '@/ui/form-field';
import { StepperFrame } from '@/ui/stepper';
import { isWhole } from './config-form';

// Khác Stepper: số gõ tay không bị kẹp vào [min, max] để server là nơi quyết; chỉ nút ± dừng ở mốc. Dáng là khung Stepper chung
export function DayInput({
  label,
  hint,
  unit,
  error,
  value,
  min,
  max,
  downLabel,
  upLabel,
  onChange,
}: {
  label: string;
  hint: string;
  unit: string;
  error?: string;
  value: string;
  min: number;
  max: number;
  downLabel: string;
  upLabel: string;
  onChange: (value: string) => void;
}) {
  const n = isWhole(value) ? Number(value) : null;
  const step = (delta: number) => onChange(String(n === null ? min : Math.min(max, Math.max(min, n + delta))));
  return (
    <FormField label={label} hint={hint} error={error}>
      {(p) => (
        <div className="cf-day-input">
          <StepperFrame className="cf-adjust" invalid={!!error} decLabel={downLabel} incLabel={upLabel} canDec={n !== null && n > min} canInc={n === null || n < max} onStep={step}>
            <input {...p} type="number" inputMode="numeric" step={1} className="num" value={value} onChange={(e) => onChange(e.target.value)} />
          </StepperFrame>
          <span className="cf-unit">{unit}</span>
        </div>
      )}
    </FormField>
  );
}
