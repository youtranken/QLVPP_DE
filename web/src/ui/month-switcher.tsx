function shiftYm(ym: string, delta: number): string {
  const [y, m] = ym.split('-').map(Number);
  const at = y * 12 + (m - 1) + delta;
  return `${Math.floor(at / 12)}-${String((at % 12) + 1).padStart(2, '0')}`;
}

interface MonthSwitcherProps {
  value: string;
  onChange: (ym: string) => void;
  formatLabel: (ym: string) => string;
  labels: { group: string; prev: string; next: string };
  min?: string;
  max?: string;
}

// ym dạng 'YYYY-MM' so sánh chuỗi được trực tiếp
export function MonthSwitcher({ value, onChange, formatLabel, labels, min, max }: MonthSwitcherProps) {
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
    </div>
  );
}
