import { shiftYm } from '@/lib/ym';
import { Icon } from '@/ui/icon';

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
  // Có thì nút kỳ sau trần bấm được (kỳ đang mở xem được), aria-pressed khi đang xem đúng kỳ đó
  onBeyond?: () => void;
}

// ym dạng 'YYYY-MM' so sánh chuỗi được trực tiếp
export function MonthSwitcher({ value, onChange, formatLabel, labels, min, max, status, beyond, onBeyond }: MonthSwitcherProps) {
  return (
    <div className="month-switch" role="group" aria-label={labels.group}>
      <button
        type="button"
        aria-label={labels.prev}
        disabled={min !== undefined && value <= min}
        onClick={() => onChange(shiftYm(value, -1))}
      >
        <Icon name="chevl" size={18} />
      </button>
      <span aria-live="polite">{formatLabel(value)}</span>
      <button
        type="button"
        aria-label={labels.next}
        disabled={max !== undefined && value >= max}
        onClick={() => onChange(shiftYm(value, 1))}
      >
        <Icon name="chevr" size={18} />
      </button>
      {beyond && (
        <button
          type="button"
          className="month-switch__beyond"
          disabled={!onBeyond}
          aria-pressed={onBeyond ? value === beyond.ym : undefined}
          onClick={onBeyond}
          aria-label={`${formatLabel(beyond.ym)} · ${beyond.label}`}>
          {beyond.label}
        </button>
      )}
      {status && <span className={`month-switch__status month-switch__status--${status.tone}`}>{status.label}</span>}
    </div>
  );
}
