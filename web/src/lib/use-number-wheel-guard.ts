import { useEffect } from 'react';

// Trình duyệt đổi số của ô number đang focus khi lăn chuột: rời focus để cuộn trang không sửa số
export function useNumberWheelGuard() {
  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      const el = e.target;
      if (el instanceof HTMLInputElement && el.type === 'number' && el === document.activeElement) el.blur();
    };
    document.addEventListener('wheel', onWheel, { capture: true, passive: true });
    return () => document.removeEventListener('wheel', onWheel, { capture: true });
  }, []);
}
