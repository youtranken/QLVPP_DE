import { useEffect, useRef, type ReactNode, type RefObject } from 'react';
import { Icon } from '@/ui/icon';
import { SearchClear } from '@/ui/search-clear';

interface SearchProps {
  value: string;
  onChange: (v: string) => void;
  label: string;
  placeholder?: string;
  maxLength?: number;
}

// Khung ngoài là label: bấm phần đệm (ngoài chữ) cũng focus ô — mọi ô tìm trên thanh công cụ dùng chung
export function SearchField({ value, onChange, label, placeholder, maxLength, inputRef, iconSize = 20 }: SearchProps & { inputRef?: RefObject<HTMLInputElement | null>; iconSize?: number }) {
  const own = useRef<HTMLInputElement>(null);
  const ref = inputRef ?? own;
  return (
    <label className="toolbar__search">
      <Icon name="search" size={iconSize} />
      <input ref={ref} type="search" aria-label={label} placeholder={placeholder} maxLength={maxLength} value={value} onChange={(e) => onChange(e.target.value)} />
      <SearchClear value={value} onClear={() => onChange('')} inputRef={ref} />
    </label>
  );
}

function isTyping(el: Element | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  return el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName);
}

export function Toolbar({ lead, search, children }: { lead?: ReactNode; search?: SearchProps; children?: ReactNode }) {
  const ref = useRef<HTMLInputElement>(null);
  const has = Boolean(search);

  useEffect(() => {
    if (!has) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.defaultPrevented || e.isComposing || e.ctrlKey || e.metaKey || e.altKey || isTyping(document.activeElement) || document.activeElement?.closest('[role="dialog"]')) return;
      e.preventDefault();
      ref.current?.focus();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [has]);

  return (
    <div className="toolbar">
      {lead}
      {search && <SearchField {...search} inputRef={ref} />}
      {children}
    </div>
  );
}
