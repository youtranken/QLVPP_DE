import { useEffect, useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

interface Props {
  count: number;
  label: string;
  onClear: () => void;
  variant?: 'dark' | 'light';
  className?: string;
  children?: ReactNode;
}

const STICKY = 'is-sticky-bottom';
// Thanh dính đáy (390): khoảng nó chiếm ở đáy = cao thanh + lề dưới 12 + khe 8 — khung trang đọc biến này để dòng cuối không bị che (B0.18)
const GAP_BELOW = 12 + 8;

function useBulkBarSpace(on: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!on || !el) return;
    const root = document.documentElement;
    const set = () => root.style.setProperty('--bulkbar-h', `${el.offsetHeight + GAP_BELOW}px`);
    set();
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(set) : null;
    ro?.observe(el);
    return () => {
      ro?.disconnect();
      root.style.removeProperty('--bulkbar-h');
    };
  }, [on]);
  return ref;
}

export function BulkBar({ count, label, onClear, variant = 'dark', className, children }: Props) {
  const { t } = useTranslation();
  const visible = count >= 1;
  const ref = useBulkBarSpace(visible && (className ?? '').split(' ').includes(STICKY));
  if (!visible) return null;
  const light = variant === 'light';
  return (
    <div ref={ref} role="toolbar" aria-label={t('common.table.bulkLabel')} className={['bulk-bar', light ? 'bulk-bar--light' : '', className ?? ''].filter(Boolean).join(' ')}>
      <b>{t('common.table.selected', { count, label })}</b>
      {children}
      <button type="button" className={light ? 'btn btn--ghost btn--sm' : 'bulk-bar__clear'} onClick={onClear}>
        {t('common.table.clearSelection')}
      </button>
    </div>
  );
}
