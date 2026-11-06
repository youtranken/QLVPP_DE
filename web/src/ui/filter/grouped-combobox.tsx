import { useId, useMemo, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { matchesSearch } from '@/lib/search';

export interface ComboOption {
  id: string;
  label: string;
  group: string;
  // Chữ để tìm (tên vi, en, mã); thiếu thì tìm theo label
  search?: string;
}

interface Props {
  options: ComboOption[];
  onPick: (id: string) => void;
  label: string;
  noMatch: string;
  placeholder?: string;
}

function groupsOf(options: ComboOption[]) {
  const map = new Map<string, ComboOption[]>();
  for (const o of options) map.set(o.group, [...(map.get(o.group) ?? []), o]);
  return [...map];
}

export function GroupedCombobox({ options, onPick, label, noMatch, placeholder }: Props) {
  const base = useId();
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const found = useMemo(() => options.filter((o) => !text.trim() || matchesSearch(o.search ?? o.label, text)), [options, text]);
  const optionId = (i: number) => `${base}-o${i}`;
  const pick = (o: ComboOption) => {
    onPick(o.id);
    setText('');
    setActive(-1);
    setOpen(false);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      setOpen(true);
      if (found.length === 0) return;
      const step = e.key === 'ArrowDown' ? 1 : -1;
      setActive((a) => (a < 0 ? (step > 0 ? 0 : found.length - 1) : (a + step + found.length) % found.length));
    } else if (e.key === 'Enter' && open && active >= 0 && found[active]) {
      e.preventDefault();
      pick(found[active]);
    } else if (e.key === 'Escape' && open) {
      e.preventDefault();
      setOpen(false);
      setActive(-1);
    }
  };
  let index = 0;
  return (
    <div className="gcb">
      <input
        type="text"
        role="combobox"
        aria-label={label}
        aria-expanded={open}
        aria-controls={`${base}-list`}
        aria-autocomplete="list"
        aria-activedescendant={open && active >= 0 ? optionId(active) : undefined}
        placeholder={placeholder}
        autoComplete="off"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setActive(-1);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
      />
      {open && found.length === 0 && (
        <p className="gcb-empty" role="status">
          {noMatch}
        </p>
      )}
      {open && found.length > 0 && (
        <div className="gcb-list" role="listbox" id={`${base}-list`} aria-label={label}>
          {groupsOf(found).map(([group, items], gi) => (
            <div key={group} role="group" aria-labelledby={`${base}-g${gi}`}>
              <div id={`${base}-g${gi}`} className="gcb-group" role="presentation">
                {group}
              </div>
              {items.map((o) => {
                const i = index++;
                return (
                  <div
                    key={o.id}
                    id={optionId(i)}
                    role="option"
                    aria-selected={i === active}
                    className="gcb-option"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pick(o)}
                  >
                    {o.label}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
