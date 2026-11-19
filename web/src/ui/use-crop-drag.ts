import { useRef } from 'react';
import type { PointerEvent as ReactPointerEvent, RefObject } from 'react';
import { moveCrop, resizeCrop } from '@/lib/crop-rect';
import type { Handle, Rect, Size } from '@/lib/crop-rect';

type Grip = Handle | 'move';

// Đổi px màn hình → px ảnh theo cỡ canvas đang hiển thị; jsdom/canvas chưa layout có rộng 0 thì coi tỉ lệ 1
function pixelScale(canvas: HTMLCanvasElement | null, bounds: Size): number {
  const shown = canvas?.getBoundingClientRect().width ?? 0;
  return shown > 0 ? shown / bounds.width : 1;
}

export function useCropDrag(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  rect: Rect,
  bounds: Size,
  setRect: (r: Rect) => void,
) {
  const drag = useRef<{ grip: Grip; sx: number; sy: number; start: Rect } | null>(null);

  const onPointerDown = (e: ReactPointerEvent<HTMLElement>) => {
    const grip = ((e.target as HTMLElement).dataset.grip as Grip | undefined) ?? 'move';
    drag.current = { grip, sx: e.clientX, sy: e.clientY, start: rect };
    e.currentTarget.setPointerCapture?.(e.pointerId);
    e.preventDefault();
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (!d) return;
    const s = pixelScale(canvasRef.current, bounds);
    const dx = Math.round((e.clientX - d.sx) / s);
    const dy = Math.round((e.clientY - d.sy) / s);
    setRect(d.grip === 'move' ? moveCrop(d.start, dx, dy, bounds) : resizeCrop(d.start, d.grip, dx, dy, bounds));
  };

  const onPointerUp = () => {
    drag.current = null;
  };

  return { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp };
}
