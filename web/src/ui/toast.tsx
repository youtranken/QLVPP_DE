import { useEffect, useState } from 'react';
import { Icon } from '@/ui/icon';
import type { ToastSpec } from '@/ui/toast-context';

const TONE_ICON = { ok: 'check', info: 'info', warn: 'alert', danger: 'alert' } as const;

export const UNDO_MS = 5000;

interface ToastProps {
  toast: ToastSpec;
  onAction: () => void;
  onPause?: () => void;
  onResume?: () => void;
  onUndo?: () => Promise<void>;
  undoLabel?: string;
  undoUntil?: number;
}

// Có nút hành động thì dừng đếm khi rê chuột/focus: người dùng kịp bấm (WCAG 2.2.1)
export function Toast({ toast, onAction, onPause, onResume, onUndo, undoLabel, undoUntil }: ToastProps) {
  const tone = toast.tone ?? 'ok';
  const hold = toast.action && onPause ? { onMouseEnter: onPause, onMouseLeave: onResume, onFocus: onPause, onBlur: onResume } : {};
  return (
    <div className={`toast toast--${tone}`} {...hold}>
      <span className="toast__ic">
        <Icon name={TONE_ICON[tone]} size={18} />
      </span>
      <span className="toast__text">{toast.text}</span>
      {onUndo && <UndoButton label={undoLabel ?? ''} until={undoUntil ?? Date.now() + UNDO_MS} onUndo={onUndo} />}
      {toast.action && (
        <button type="button" className="toast__action" onClick={onAction}>
          {toast.action.label}
        </button>
      )}
      {onUndo && <UndoBar until={undoUntil ?? Date.now() + UNDO_MS} />}
    </div>
  );
}

// Vạch chạy đúng phần còn lại của cửa sổ server (thao tác nhiều bước bắt đầu đếm trước khi toast hiện)
function UndoBar({ until }: { until: number }) {
  const [ms] = useState(() => Math.max(0, until - Date.now()));
  return <span className="toast__bar" aria-hidden="true" style={{ animationDuration: `${ms}ms` }} />;
}

// Số giây ẩn với trình đọc màn hình: vùng status không đọc lại mỗi giây
function UndoButton({ label, until, onUndo }: { label: string; until: number; onUndo: () => Promise<void> }) {
  const secondsLeft = () => Math.max(1, Math.ceil((until - Date.now()) / 1000));
  const [left, setLeft] = useState(secondsLeft);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const id = setInterval(() => setLeft(secondsLeft()), 250);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [until]);
  return (
    <button
      type="button"
      className="toast__action toast__undo"
      disabled={busy}
      onClick={() => {
        if (busy) return;
        setBusy(true);
        void onUndo();
      }}
    >
      {label}
      <span aria-hidden="true"> ({left})</span>
    </button>
  );
}
