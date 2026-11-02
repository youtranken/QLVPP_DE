import { useRef, useState, type DragEvent } from 'react';

// Kéo thả HTML5 cho chuột; bàn phím và điện thoại dùng nút ▲▼ (HTML5 drag không chạy trên cảm ứng)
export function useRowDrag(onMoveTo: (from: number, to: number) => void) {
  const from = useRef<number | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const reset = () => {
    from.current = null;
    setOver(null);
  };
  return (index: number) => ({
    draggable: true,
    className: over === index ? 'is-drop-target' : undefined,
    onDragStart: (e: DragEvent) => {
      from.current = index;
      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', String(index));
      }
    },
    onDragOver: (e: DragEvent) => {
      if (from.current === null) return;
      e.preventDefault();
      if (over !== index) setOver(index);
    },
    onDrop: (e: DragEvent) => {
      e.preventDefault();
      if (from.current !== null && from.current !== index) onMoveTo(from.current, index);
      reset();
    },
    onDragEnd: reset,
  });
}
