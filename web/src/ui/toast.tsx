import { Icon } from '@/ui/icon';
import type { ToastSpec } from '@/ui/toast-context';

const TONE_ICON = { ok: 'check', info: 'info', warn: 'alert', danger: 'alert' } as const;

export function Toast({ toast, onAction }: { toast: ToastSpec; onAction: () => void }) {
  const tone = toast.tone ?? 'ok';
  return (
    <div className={`toast toast--${tone}`}>
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
