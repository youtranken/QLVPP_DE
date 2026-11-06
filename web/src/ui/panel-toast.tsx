import { useCallback, useEffect, useRef, useState } from 'react';
import { Toast } from '@/ui/toast';
import type { ToastSpec } from '@/ui/toast-context';

// Toast có nút trong panel phủ: toast chung nằm ngoài hộp nên bị Radix ẩn khỏi trình đọc màn hình và bấm vào thì đóng panel
export function usePanelToast(ms: number) {
  const [toast, setToast] = useState<ToastSpec | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const start = useCallback(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), ms);
  }, [ms]);
  const pause = useCallback(() => clearTimeout(timer.current), []);
  const show = useCallback(
    (next: ToastSpec) => {
      setToast(next);
      start();
    },
    [start],
  );
  useEffect(() => () => clearTimeout(timer.current), []);
  const host = (
    <div className="toast-host" role="status">
      {toast && (
        <Toast
          toast={toast}
          onPause={pause}
          onResume={start}
          onAction={() => {
            toast.action?.onClick();
            pause();
            setToast(null);
          }}
        />
      )}
    </div>
  );
  return { show, host };
}
