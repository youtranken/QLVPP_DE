import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Icon } from '@/ui/icon';

const GAP = 4;
const EDGE = 8;

// position: fixed để khung cuộn của bảng không cắt mất; canh trong màn hình (390 px)
function placeNear(button: HTMLElement, panel: HTMLElement): CSSProperties {
  const b = button.getBoundingClientRect();
  const w = panel.offsetWidth;
  const left = Math.min(Math.max(EDGE, b.right - w), window.innerWidth - w - EDGE);
  const below = b.bottom + GAP + panel.offsetHeight <= window.innerHeight;
  const top = below ? b.bottom + GAP : Math.max(EDGE, b.top - GAP - panel.offsetHeight);
  return { position: 'fixed', left: Math.max(EDGE, left), top };
}

export function InfoTip({ label, showLabel = false, children }: { label: string; showLabel?: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [style, setStyle] = useState<CSSProperties>({ position: 'fixed', visibility: 'hidden' });
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const id = useId();

  useLayoutEffect(() => {
    if (open && button.current && panel.current) setStyle(placeNear(button.current, panel.current));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!panel.current?.contains(t) && !button.current?.contains(t)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setOpen(false);
      button.current?.focus();
    };
    const onScroll = () => {
      if (button.current && panel.current) setStyle(placeNear(button.current, panel.current));
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [open]);

  return (
    <span className="info-tip">
      <button
        ref={button}
        type="button"
        className={showLabel ? 'info-tip__btn info-tip__btn--text' : 'info-tip__btn'}
        aria-label={showLabel ? undefined : label}
        title={showLabel ? undefined : label}
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen((v) => !v)}
      >
        <Icon name="info" size={16} />
        {showLabel && label}
      </button>
      {open && (
        <div ref={panel} id={id} role="dialog" aria-label={label} className="info-tip__panel" style={style}>
          {children}
        </div>
      )}
    </span>
  );
}
