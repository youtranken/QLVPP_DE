import { useEffect, useRef, type RefObject } from 'react';

// Khung cuộn ngang (hàng chip/tab ở điện thoại): mép nào còn nội dung khuất thì mờ dần.
// Ghi `data-fade` = "start" | "end" | "start end" lên khung, bỏ khi không cuộn được; CSS mờ mép ở một chỗ (scroll-fade.css,
// khai ở main.tsx — hook không tự import, nếu không CSS bị tách thành file riêng nạp trước mọi CSS khác, lệch cascade).
export function fadeEdges(el: HTMLElement): string | null {
  const max = el.scrollWidth - el.clientWidth;
  if (max <= 1) return null;
  const edges = [el.scrollLeft > 1 && 'start', max - el.scrollLeft > 1 && 'end'].filter(Boolean);
  return edges.length ? edges.join(' ') : null;
}

export function useScrollFade<T extends HTMLElement>(enabled = true): RefObject<T | null> {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;
    const update = () => {
      const fade = fadeEdges(el);
      if (fade) el.dataset.fade = fade;
      else delete el.dataset.fade;
    };
    // Mục đang chọn nằm khuất bên phải (vd. tab "Tất cả" ở 360) thì cuộn tới cho thấy, chỉ lần đầu vẽ
    const current = el.querySelector<HTMLElement>('[aria-checked="true"], [aria-pressed="true"], [aria-selected="true"]');
    if (current) {
      const overflow = current.getBoundingClientRect().right - el.getBoundingClientRect().right;
      if (overflow > 0) el.scrollLeft += overflow + 16;
    }
    update();
    el.addEventListener('scroll', update, { passive: true });
    // Số đếm trong chip tải sau làm hàng dài ra mà khung không đổi cỡ → theo dõi cả các mục con
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update);
    ro?.observe(el);
    for (const child of Array.from(el.children)) ro?.observe(child);
    // Chip thêm/bớt sau lần vẽ đầu (nhóm tải xong, đổi bộ lọc): tính lại ngay và theo dõi cả mục mới
    const mo =
      typeof MutationObserver === 'undefined'
        ? null
        : new MutationObserver((records) => {
            for (const r of records) for (const n of Array.from(r.addedNodes)) if (n instanceof Element) ro?.observe(n);
            update();
          });
    mo?.observe(el, { childList: true });
    return () => {
      el.removeEventListener('scroll', update);
      ro?.disconnect();
      mo?.disconnect();
    };
  }, [enabled]);
  return ref;
}
