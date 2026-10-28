import { useState } from 'react';
import { useTranslation } from 'react-i18next';

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

// Ô giữa gõ được để không phải bấm + hai chục lần; giá trị luôn kẹp trong [min, max]
export function Stepper({
  value,
  min = 0,
  max,
  onChange,
  label,
  className,
}: {
  value: number;
  min?: number;
  max: number;
  onChange: (value: number) => void;
  label: string;
  className?: string;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<string | null>(null);
  const set = (n: number) => {
    const next = clamp(n, min, max);
    if (next !== value) onChange(next);
  };
  const type = (text: string) => {
    if (!/^\d*$/.test(text)) return;
    if (text === '') return setDraft('');
    setDraft(null);
    set(Number(text));
  };
  return (
    <div className={['stepper', className].filter(Boolean).join(' ')}>
      <button
        type="button"
        aria-label={t('common.stepper.decrease', { label })}
        disabled={value <= min}
        onClick={() => set(value - 1)}
      >
        −
      </button>
      <input
        type="number"
        inputMode="numeric"
        className="num"
        aria-label={label}
        min={min}
        max={max}
        value={draft ?? value}
        onChange={(e) => type(e.target.value)}
        onBlur={() => setDraft(null)}
      />
      <button
        type="button"
        aria-label={t('common.stepper.increase', { label })}
        disabled={value >= max}
        onClick={() => set(value + 1)}
      >
        +
      </button>
    </div>
  );
}
