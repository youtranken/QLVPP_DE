import { Icon } from '@/ui/icon';

export interface SelectOption<T extends string> {
  value: T;
  label: string;
}

interface Props<T extends string> {
  label: string;
  value: T;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
  hideLabel?: boolean;
  disabled?: boolean;
  title?: string;
}

export function Select<T extends string>({ label, value, options, onChange, hideLabel, disabled, title }: Props<T>) {
  return (
    <label className="select">
      <span className={hideLabel ? 'sr-only' : 'select__label'}>{label}</span>
      <span className="select__box">
        <select value={value} disabled={disabled} title={title} onChange={(e) => onChange(e.target.value as T)}>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <Icon name="chev" size={16} />
      </span>
    </label>
  );
}
