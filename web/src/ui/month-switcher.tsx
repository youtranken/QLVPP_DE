import { shiftYm } from '@/lib/ym';

interface MonthSwitcherProps {
  value: string;
  onChange: (ym: string) => void;
  formatLabel: (ym: string) => string;
  labels: { group: string; prev: string; next: string };
  min?: string;
  max?: string;
  status?: { tone: 'ok' | 'dark'; label: string };
}

// ym dạng 'YYYY-MM' so sánh chuỗi được trực tiếp
export function MonthSwitcher({ value, onChange, formatLabel, labels, min, max, status }: MonthSwitcherProps) {
  return (
    <div className="month-switch" role="group" aria-label={labels.group}>
      <button
        type="button"
        aria-label={labels.prev}
        disabled={min !== undefined && value <= min}
        onClick={() => onChange(shiftYm(value, -1))}
      >
        ‹
      </button>
      <span aria-live="polite">{formatLabel(value)}</span>
      <button
        type="button"
        aria-label={labels.next}
        disabled={max !== undefined && value >= max}
        onClick={() => onChange(shiftYm(value, 1))}
      >
        ›
      </button>
      {status && <span className={`month-switch__status month-switch__status--${status.tone}`}>{status.label}</span>}
    </div>
  );
}
