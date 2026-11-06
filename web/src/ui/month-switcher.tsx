import { shiftYm } from '@/lib/ym';

interface MonthSwitcherProps {
  value: string;
  onChange: (ym: string) => void;
  formatLabel: (ym: string) => string;
  labels: { group: string; prev: string; next: string };
  min?: string;
  max?: string;
  status?: { tone: 'ok' | 'dark'; label: string };
  // Kỳ sau trần (kỳ đang mở) hiện vô hiệu kèm nhãn, để người xem biết vì sao không đi tiếp được
  beyond?: { ym: string; label: string };
}

// ym dạng 'YYYY-MM' so sánh chuỗi được trực tiếp
export function MonthSwitcher({ value, onChange, formatLabel, labels, min, max, status, beyond }: MonthSwitcherProps) {
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
      {beyond && (
        <button type="button" className="month-switch__beyond" disabled aria-label={`${formatLabel(beyond.ym)} · ${beyond.label}`}>
          {beyond.label}
        </button>
      )}
      {status && <span className={`month-switch__status month-switch__status--${status.tone}`}>{status.label}</span>}
    </div>
  );
}
