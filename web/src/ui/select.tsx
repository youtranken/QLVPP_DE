import { useId } from 'react';
import { Listbox, type ListboxOption } from '@/ui/listbox';

export type SelectOption<T extends string> = ListboxOption<T>;

interface Props<T extends string> {
  label: string;
  value: T;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
  hideLabel?: boolean;
  stacked?: boolean;
  disabled?: boolean;
  title?: string;
}

// Ô chọn có nhãn cho thanh lọc. Nhãn hiện thì trỏ aria-labelledby, nhãn ẩn thì aria-label
export function Select<T extends string>({ label, value, options, onChange, hideLabel, stacked, disabled, title }: Props<T>) {
  const id = useId();
  const labelId = `${id}-label`;
  return (
    <div className={stacked ? 'select select--stacked' : 'select'}>
      {!hideLabel && (
        <span id={labelId} className="select__label">
          {label}
        </span>
      )}
      <Listbox
        variant={stacked ? 'field' : 'pill'}
        value={value}
        options={options}
        onChange={onChange}
        disabled={disabled}
        title={title}
        aria-label={hideLabel ? label : undefined}
        aria-labelledby={hideLabel ? undefined : labelId}
      />
    </div>
  );
}
