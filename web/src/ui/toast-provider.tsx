import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Toast } from '@/ui/toast';
import { ToastContext } from '@/ui/toast-context';
import type { ToastSpec } from '@/ui/toast-context';

export const TOAST_MS = 4000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastSpec | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const dismiss = useCallback(() => {
    clearTimeout(timer.current);
    setToast(null);
  }, []);
  const startTimer = useCallback(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), TOAST_MS);
  }, []);
  const pause = useCallback(() => clearTimeout(timer.current), []);
  const show = useCallback(
    (next: ToastSpec) => {
      setToast(next);
      startTimer();
    },
    [startTimer],
  );
  useEffect(() => () => clearTimeout(timer.current), []);

  const api = useMemo(() => ({ show }), [show]);
  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-host" role="status">
        {toast && (
          <Toast
            toast={toast}
            onPause={pause}
            onResume={startTimer}
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
