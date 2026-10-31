import type { KeyboardEvent } from 'react';

interface Option<T extends string> {
  value: T;
  label: string;
  count?: number;
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
          aria-label={o.count !== undefined ? `${o.label}, ${o.count}` : undefined}
          tabIndex={o.value === value ? 0 : -1}
          onClick={() => onChange(o.value)}
          onKeyDown={(e) => move(e, i)}
        >
          {o.label}
          {o.count !== undefined && <em className="num">{o.count}</em>}
        </button>
      ))}
    </div>
  );
}
