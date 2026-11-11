import { useRef, type RefObject } from 'react';
import { useUrlSearchBox } from '@/lib/use-url-search-box';
import { IconSearch } from '@/ui/icons';
import { SearchClear } from '@/ui/search-clear';

interface Props {
  // Giá trị đã đẩy lên URL; ô giữ chữ đang gõ và đẩy lên sau debounce
  value: string;
  onChange: (q: string) => void;
  label: string;
  placeholder?: string;
  className?: string;
  inputRef?: RefObject<HTMLInputElement | null>;
}

export function SearchBox({ value, onChange, label, placeholder, className, inputRef }: Props) {
  const [text, setText] = useUrlSearchBox(value, onChange);
  const ownRef = useRef<HTMLInputElement>(null);
  const ref = inputRef ?? ownRef;
  return (
    <label className={className}>
      <IconSearch />
      <input ref={ref} type="search" aria-label={label} placeholder={placeholder} value={text} onChange={(e) => setText(e.target.value)} />
      <SearchClear className="search-box-x" value={text} onClear={() => setText('')} inputRef={ref} />
    </label>
  );
}
