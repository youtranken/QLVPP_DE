import { useEffect, useRef, useState } from 'react';
import { useDebouncedValue } from '@/lib/use-debounced-value';

// Gõ → đẩy q (debounce) lên URL; q đổi từ ngoài (Back, liên kết) → đồng bộ lại ô
export function useUrlSearchBox(q: string, setQ: (v: string) => void) {
  const [text, setText] = useState(q);
  const debounced = useDebouncedValue(text.trim(), 300);
  const pushed = useRef(q);
  const push = useRef(setQ);
  useEffect(() => {
    push.current = setQ;
  });
  useEffect(() => {
    if (debounced === pushed.current) return;
    pushed.current = debounced;
    push.current(debounced);
  }, [debounced]);
  useEffect(() => {
    if (q === pushed.current) return;
    pushed.current = q;
    setText(q);
  }, [q]);
  return [text, setText] as const;
}
