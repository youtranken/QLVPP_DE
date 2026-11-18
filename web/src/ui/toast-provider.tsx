import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { apiErrorCode } from '@/lib/api-error';
import { Toast, UNDO_MS } from '@/ui/toast';
import { ToastContext } from '@/ui/toast-context';
import type { ToastSpec } from '@/ui/toast-context';

export const TOAST_MS = 4000;

const UNDO_ERROR_KEY: Record<string, string> = {
  UNDO_EXPIRED: 'common.undo.expired',
  UNDO_ALREADY_DONE: 'common.undo.alreadyDone',
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const [toast, setToast] = useState<ToastSpec | null>(null);
  const [undoUntil, setUndoUntil] = useState(0);
  const [seq, setSeq] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const dismiss = useCallback(() => {
    clearTimeout(timer.current);
    setToast(null);
  }, []);
  const startTimer = useCallback((ms = TOAST_MS) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), ms);
  }, []);
  const pause = useCallback(() => clearTimeout(timer.current), []);
  const show = useCallback(
    (spec: ToastSpec) => {
      const now = Date.now();
      const undoMs = spec.undo ? UNDO_MS - (now - (spec.undoSince ?? now)) : 0;
      const next = spec.undo && undoMs <= 0 ? { ...spec, undo: undefined } : spec;
      setToast(next);
      setUndoUntil(now + undoMs);
      setSeq((n) => n + 1);
      if (next.undo) startTimer(undoMs);
      else if (next.persist) clearTimeout(timer.current);
      else startTimer();
    },
    [startTimer],
  );
  const dismissOne = useCallback((which: ToastSpec) => setToast((cur) => (cur === which ? null : cur)), []);
  const runUndo = useCallback(
    async (undo: () => Promise<unknown>) => {
      clearTimeout(timer.current);
      try {
        await undo();
        show({ text: t('common.undo.done'), tone: 'info' });
      } catch (error) {
        show({ text: t(UNDO_ERROR_KEY[apiErrorCode(error) ?? ''] ?? 'common.undo.failed'), tone: 'warn' });
      }
    },
    [show, t],
  );
  useEffect(() => () => clearTimeout(timer.current), []);

  const api = useMemo(() => ({ show, dismiss: dismissOne }), [show, dismissOne]);
  const hold = toast && !toast.undo;
  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-host" role="status">
        {toast && (
          <Toast
            key={seq}
            toast={toast}
            undoLabel={t('common.undo.label')}
            undoUntil={undoUntil}
            onPause={hold ? pause : undefined}
            onResume={hold ? (toast.persist ? pause : () => startTimer()) : undefined}
            onUndo={toast.undo ? () => runUndo(toast.undo!) : undefined}
            onAction={() => {
              toast.action?.onClick();
              dismiss();
            }}
          />
        )}
      </div>
    </ToastContext.Provider>
  );
}
