import { useEffect, useRef, type ReactNode } from 'react';
import { Icon } from '@/ui/icon';

interface SearchProps {
  value: string;
  onChange: (v: string) => void;
  label: string;
  placeholder?: string;
  maxLength?: number;
}

function isTyping(el: Element | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  return el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName);
}

export function Toolbar({ search, children }: { search?: SearchProps; children?: ReactNode }) {
  const ref = useRef<HTMLInputElement>(null);
  const has = Boolean(search);

  useEffect(() => {
    if (!has) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey || isTyping(document.activeElement)) return;
      e.preventDefault();
      ref.current?.focus();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [has]);

  return (
    <div className="toolbar">
      {search && (
        <label className="toolbar__search">
          <Icon name="search" size={20} />
          <input
            ref={ref}
            type="search"
            aria-label={search.label}
            placeholder={search.placeholder}
            maxLength={search.maxLength}
            value={search.value}
            onChange={(e) => search.onChange(e.target.value)}
          />
        </label>
      )}
      {children}
    </div>
  );
}
