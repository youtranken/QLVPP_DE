import { useEffect, useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

interface Props {
  count: number;
  label: string;
  onClear: () => void;
  variant?: 'dark' | 'light';
  // Dính đáy màn hình ở điện thoại (CSS .is-sticky-bottom); khung trang chừa đúng khoảng thanh chiếm
  sticky?: boolean;
  className?: string;
  children?: ReactNode;
}

// Khoảng thanh dính đáy chiếm = cao thanh + lề dưới 12 + khe 8; khung trang đọc biến này để dòng cuối không bị che
const GAP_BELOW = 12 + 8;
const VAR = '--bulkbar-h';

// Mỗi khung (phần tử data-shell) giữ chiều cao của mọi thanh đang dính đáy; biến = thanh cao nhất,
// gỡ biến khi không còn thanh nào — hai thanh cùng lúc hay gỡ theo thứ tự nào cũng đúng
const spaces = new Map<HTMLElement, Map<HTMLElement, number>>();

function apply(host: HTMLElement): void {
  const bars = spaces.get(host);
  if (!bars || bars.size === 0) {
    spaces.delete(host);
    host.style.removeProperty(VAR);
    return;
  }
  host.style.setProperty(VAR, `${Math.max(...bars.values())}px`);
}

function useBulkBarSpace(on: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!on || !el) return;
    const host = el.closest<HTMLElement>('[data-shell]') ?? document.body;
    const set = () => {
      const bars = spaces.get(host) ?? new Map<HTMLElement, number>();
      bars.set(el, el.offsetHeight + GAP_BELOW);
      spaces.set(host, bars);
      apply(host);
    };
    set();
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(set) : null;
    ro?.observe(el);
    return () => {
      ro?.disconnect();
      spaces.get(host)?.delete(el);
      apply(host);
    };
  }, [on]);
  return ref;
}

export function BulkBar({ count, label, onClear, variant = 'dark', sticky = false, className, children }: Props) {
  const { t } = useTranslation();
  const visible = count >= 1;
  const ref = useBulkBarSpace(visible && sticky);
  if (!visible) return null;
  const light = variant === 'light';
  return (
    <div
      ref={ref}
      role="toolbar"
      aria-label={t('common.table.bulkLabel')}
      className={['bulk-bar', light ? 'bulk-bar--light' : '', sticky ? 'is-sticky-bottom' : '', className ?? ''].filter(Boolean).join(' ')}
    >
      <b>{t('common.table.selected', { count, label })}</b>
      {children}
      <button type="button" className={light ? 'btn btn--ghost btn--sm' : 'bulk-bar__clear'} onClick={onClear}>
        {t('common.table.clearSelection')}
      </button>
    </div>
  );
}
