import { useCallback, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ConfirmDialog } from '@/ui/confirm-dialog';
import { ConfirmCtx, type ConfirmFn, type ConfirmOptions } from '@/ui/confirm-context';

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((v: boolean) => void) | null>(null);

  const askConfirm = useCallback<ConfirmFn>((o) => {
    // Hộp cũ chưa trả lời mà bị gọi chồng → settle(false), nếu không Promise cũ treo mãi
    resolver.current?.(false);
    setOpts(o);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const settle = (result: boolean) => {
    resolver.current?.(result);
    resolver.current = null;
    setOpts(null);
  };

  return (
    <ConfirmCtx.Provider value={askConfirm}>
      {children}
      {opts && (
        <ConfirmDialog
          title={opts.title ?? t('common.confirmTitle')}
          message={opts.message}
          confirmLabel={opts.confirmLabel ?? t('common.confirmOk')}
          cancelLabel={opts.cancelLabel}
          danger={opts.danger}
          warning={opts.warning}
          caution={opts.caution}
          onConfirm={() => settle(true)}
          onCancel={() => settle(false)}
        />
      )}
    </ConfirmCtx.Provider>
  );
}
