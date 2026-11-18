import { useCallback, useLayoutEffect, useRef } from 'react';

// Đổi giữa kỳ khóa và kỳ đăng ký dựng lại thanh công cụ nên bộ chọn kỳ là phần tử mới: trả focus về đúng nút ‹ / nhãn / › vừa bấm
export function useSwitchFocus(ym: string | undefined, setYm: (next: string) => void) {
  const slot = useRef<number | null>(null);
  useLayoutEffect(() => {
    const at = slot.current;
    slot.current = null;
    if (at === null || (document.activeElement && document.activeElement !== document.body)) return;
    const buttons = [...document.querySelectorAll<HTMLButtonElement>('.mk-page .month-switch button')];
    (buttons[at]?.disabled ? buttons.find((b) => !b.disabled) : buttons[at])?.focus();
  }, [ym]);
  return useCallback(
    (next: string) => {
      const a = document.activeElement;
      const group = a?.closest('.month-switch');
      slot.current = group ? [...group.querySelectorAll('button')].indexOf(a as HTMLButtonElement) : null;
      setYm(next);
    },
    [setYm],
  );
}
