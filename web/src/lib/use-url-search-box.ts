import { useEffect, useRef, useState } from 'react';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { onUrlPatch } from '@/lib/use-url-patch';

// Gõ → đẩy q (debounce) lên URL; q đổi từ ngoài (Back, liên kết) → đồng bộ lại ô.
// Trang khác ghi thẳng khóa `param` qua useUrlPatch ("Xóa lọc" trong 300 ms sau khi gõ) → bỏ chữ đang chờ debounce, ô theo giá trị
// vừa ghi; không thì chữ cũ được đẩy lại lên và bộ lọc tự bật lại. Bấm chip (không đụng `param`) thì chữ đang gõ vẫn giữ.
export function useUrlSearchBox(q: string, setQ: (v: string) => void, param = 'q') {
  const [text, setText] = useState(q);
  const debounced = useDebouncedValue(text.trim(), 300);
  const pushed = useRef(q);
  const push = useRef(setQ);
  const pushing = useRef(false);
  useEffect(() => {
    push.current = setQ;
  });
  useEffect(() => {
    if (debounced === pushed.current) return;
    pushed.current = debounced;
    pushing.current = true;
    try {
      push.current(debounced);
    } finally {
      pushing.current = false;
    }
  }, [debounced]);
  useEffect(() => {
    if (q === pushed.current) return;
    pushed.current = q;
    setText(q);
  }, [q]);
  useEffect(
    () =>
      onUrlPatch((patch) => {
        if (pushing.current || !(param in patch)) return;
        const v = patch[param] ?? '';
        pushed.current = v;
        setText(v);
      }),
    [param],
  );
  return [text, setText] as const;
}
