import { useEffect, useId, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';

// Hộp nhỏ không chặn trang: mở thì focus mục đầu, Esc đóng và trả focus về nút mở, bấm ra ngoài đóng.
// Truyền controlled khi nơi gọi giữ trạng thái mở (hộp tài khoản nhân viên).
export function usePopover(controlled?: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [own, setOwn] = useState(false);
  const open = controlled ? controlled.open : own;
  const onOpenChange = controlled?.onOpenChange;
  const setOpen = (next: boolean | ((v: boolean) => boolean)) => {
    const value = typeof next === 'function' ? next(open) : next;
    if (onOpenChange) onOpenChange(value);
    else setOwn(value);
  };
  const box = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    panel.current?.querySelector<HTMLElement>('[aria-checked="true"], button')?.focus();
    const onPointer = (e: PointerEvent) => {
      // Chuông nằm trong cùng khối nhưng không thuộc hộp này: bấm chuông cũng là bấm ra ngoài
      const t = e.target as Node;
      if (panel.current?.contains(t) || trigger.current?.contains(t)) return;
      if (onOpenChange) onOpenChange(false);
      else setOwn(false);
    };
    document.addEventListener('pointerdown', onPointer);
    return () => document.removeEventListener('pointerdown', onPointer);
  }, [open, onOpenChange]);
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'Escape' || !open) return;
    setOpen(false);
    trigger.current?.focus();
  };
  return { open, setOpen, box, trigger, panel, id, onKeyDown };
}
