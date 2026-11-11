import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent } from 'react';
import { Icon } from '@/ui/icon';

export interface RowMenuItem {
  label: string;
  onSelect: () => void;
  disabled?: boolean;
  danger?: boolean;
  title?: string;
}

const GAP = 4;

// position: fixed để menu không bị khung cuộn của bảng cắt mất ở hàng cuối
function placeBelowOrAbove(button: HTMLElement, menu: HTMLElement): CSSProperties {
  const b = button.getBoundingClientRect();
  const h = menu.offsetHeight;
  const below = b.bottom + GAP + h <= window.innerHeight;
  const top = below ? b.bottom + GAP : Math.max(GAP, b.top - GAP - h);
  // Nút sát mép trái (⋯ đứng trước nút chính ở 390): canh trái theo nút, không thì menu tràn khỏi màn hình
  if (b.right - menu.offsetWidth < GAP) return { position: 'fixed', left: Math.max(GAP, b.left), top };
  return { position: 'fixed', right: Math.max(GAP, window.innerWidth - b.right), top };
}

export function RowMenu({ label, items }: { label: string; items: RowMenuItem[] }) {
  const [open, setOpen] = useState(false);
  const [style, setStyle] = useState<CSSProperties>({ position: 'fixed', visibility: 'hidden' });
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const id = useId();

  const itemEls = () => Array.from(menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
  const focusAt = (i: number) => {
    const els = itemEls();
    els[(i + els.length) % els.length]?.focus();
  };
  const close = (refocus: boolean) => {
    setOpen(false);
    if (refocus) button.current?.focus();
  };

  useLayoutEffect(() => {
    if (!open || !button.current || !menu.current) return;
    setStyle(placeBelowOrAbove(button.current, menu.current));
    focusAt(0);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!menu.current?.contains(t) && !button.current?.contains(t)) close(false);
    };
    // Đóng khi cuộn làm menu tự tắt ngay sau cú bấm (trình duyệt cuộn nút vào khung nhìn); bám theo nút thay vì đóng
    const onScroll = () => {
      if (button.current && menu.current) setStyle(placeBelowOrAbove(button.current, menu.current));
    };
    document.addEventListener('pointerdown', onPointer);
    window.addEventListener('resize', onScroll);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      window.removeEventListener('resize', onScroll);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [open]);

  const onMenuKey = (e: KeyboardEvent) => {
    const i = itemEls().indexOf(document.activeElement as HTMLElement);
    const moves: Record<string, number> = { ArrowDown: i + 1, ArrowUp: i - 1, Home: 0, End: -1 };
    if (e.key in moves) {
      e.preventDefault();
      focusAt(moves[e.key]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close(true);
    } else if (e.key === 'Tab') {
      close(false);
    }
  };
  const onButtonKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      setOpen(true);
    }
  };
  const select = (item: RowMenuItem) => {
    if (item.disabled) return;
    // Focus về nút ⋯ trước khi mở hộp thoại: mục menu sắp bị gỡ, hộp lấy phần tử đang focus làm nơi trả về
    close(true);
    item.onSelect();
  };

  return (
    <>
      <button
        ref={button}
        type="button"
        className="btn btn--ghost btn--sm ct-icon-btn"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onButtonKey}
      >
        <Icon name="more" size={18} />
      </button>
      {open && (
        <div ref={menu} id={id} role="menu" aria-label={label} className="row-menu" style={style} onKeyDown={onMenuKey}>
          {items.map((item, i) => {
            // Lý do mục bị tắt hiện thành dòng chữ nhỏ ngay trong mục (không chỉ nằm trong title), đọc qua aria-describedby
            const hint = item.disabled && item.title ? `${id}-hint-${i}` : undefined;
            return (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                tabIndex={-1}
                className={item.danger ? 'row-menu__item row-menu__item--danger' : 'row-menu__item'}
                aria-disabled={item.disabled || undefined}
                aria-label={hint ? item.label : undefined}
                aria-describedby={hint}
                title={hint ? undefined : item.title}
                onClick={() => select(item)}
              >
                {item.label}
                {hint && (
                  <small id={hint} className="row-menu__hint">
                    {item.title}
                  </small>
                )}
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}
