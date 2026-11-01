import { Icon } from '@/ui/icon';
import type { ToastSpec } from '@/ui/toast-context';

const TONE_ICON = { ok: 'check', info: 'info', warn: 'alert', danger: 'alert' } as const;

interface ToastProps {
  toast: ToastSpec;
  onAction: () => void;
  onPause?: () => void;
  onResume?: () => void;
}

// Có nút hành động thì dừng đếm khi rê chuột/focus: người dùng kịp bấm (WCAG 2.2.1)
export function Toast({ toast, onAction, onPause, onResume }: ToastProps) {
  const tone = toast.tone ?? 'ok';
  const hold = toast.action ? { onMouseEnter: onPause, onMouseLeave: onResume, onFocus: onPause, onBlur: onResume } : {};
  return (
    <div className={`toast toast--${tone}`} {...hold}>
      <span className="toast__ic">
        <Icon name={TONE_ICON[tone]} size={18} />
      </span>
      <span className="toast__text">{toast.text}</span>
      {toast.action && (
        <button type="button" className="toast__action" onClick={onAction}>
          {toast.action.label}
        </button>
      )}
    </div>
  );
}
