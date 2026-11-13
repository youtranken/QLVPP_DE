import { useEffect, useRef, type ReactNode } from 'react';

// Khung cuộn ngang: mép phải mờ dần khi còn nội dung khuất (data-more), cuộn tới cuối thì hết mờ
export function ScrollFade({ className, children }: { className?: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const more = el.scrollWidth - el.clientWidth - el.scrollLeft > 1;
      if (more) el.dataset.more = '';
      else delete el.dataset.more;
    };
    // Mục đang chọn nằm khuất bên phải (vd. tab "Tất cả" ở 360) thì cuộn tới cho thấy, chỉ lần đầu vẽ
    const current = el.querySelector<HTMLElement>('[aria-checked="true"], [aria-pressed="true"], [aria-selected="true"]');
    if (current) {
      const overflow = current.getBoundingClientRect().right - el.getBoundingClientRect().right;
      if (overflow > 0) el.scrollLeft += overflow + 16;
    }
    update();
    el.addEventListener('scroll', update, { passive: true });
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update);
    ro?.observe(el);
    if (el.firstElementChild) ro?.observe(el.firstElementChild);
    return () => {
      el.removeEventListener('scroll', update);
      ro?.disconnect();
    };
  }, []);
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
