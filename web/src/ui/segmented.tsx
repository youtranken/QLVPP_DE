import type { KeyboardEvent } from 'react';

interface Option<T extends string> {
  value: T;
  label: string;
  ariaLabel?: string;
  count?: number;
  // Tab cần người xử lý (Chờ xem, Chưa nhận…): số khác 0 tô đỏ đất. Tab khác (Tất cả, Đã chấp nhận) số trung tính —
  // tô đỏ mọi số thì đỏ mất nghĩa "cần làm"
  urgent?: boolean;
}

interface Props<T extends string> {
  label: string;
  value: T;
  options: Option<T>[];
  onChange: (v: T) => void;
}

export function Segmented<T extends string>({ label, value, options, onChange }: Props<T>) {
  const move = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = options[(index + step + options.length) % options.length]!;
    onChange(next.value);
    const radios = e.currentTarget.parentElement?.querySelectorAll<HTMLElement>('[role="radio"]');
    radios?.[(index + step + options.length) % options.length]?.focus();
  };

  return (
    <div role="radiogroup" aria-label={label} className="seg-m1">
      {options.map((o, i) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          aria-label={o.count !== undefined ? `${o.ariaLabel ?? o.label}, ${o.count}` : o.ariaLabel}
          tabIndex={o.value === value ? 0 : -1}
          onClick={() => onChange(o.value)}
          onKeyDown={(e) => move(e, i)}
        >
          {o.label}
          {o.count !== undefined && <em className="num" data-zero={o.count === 0 || undefined} data-urgent={(o.urgent && o.count > 0) || undefined}>{o.count}</em>}
        </button>
      ))}
    </div>
  );
}
