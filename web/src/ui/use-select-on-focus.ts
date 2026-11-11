import { useCallback, useEffect, useRef, type FocusEvent } from 'react';

// select() gọi thẳng trong focus bị iOS/Android bỏ (con trỏ đặt sau khi focus xong) → đợi một khung hình
export function useSelectOnFocus() {
  const frame = useRef(0);
  useEffect(() => () => cancelAnimationFrame(frame.current), []);
  return useCallback((e: FocusEvent<HTMLInputElement>) => {
    const el = e.currentTarget;
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      if (document.activeElement === el) el.select();
    });
  }, []);
}
