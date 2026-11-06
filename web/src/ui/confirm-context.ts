import { createContext, useContext, type ReactNode } from 'react';

export type ConfirmOptions = {
  message: string;
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  // Khối cảnh báo cam không chặn: nút chính vẫn bấm được
  warning?: ReactNode;
};

export type ConfirmFn = (o: ConfirmOptions) => Promise<boolean>;

// null = ngoài ConfirmProvider (vd màn đăng nhập)
export const ConfirmCtx = createContext<ConfirmFn | null>(null);

export function useOptionalConfirm(): ConfirmFn | null {
  return useContext(ConfirmCtx);
}

const NO_CONFIRM: ConfirmFn = () => Promise.resolve(false);

export function useConfirm(): ConfirmFn {
  return useContext(ConfirmCtx) ?? NO_CONFIRM;
}

export const discardOptions = (t: (key: string) => string): ConfirmOptions => ({
  title: t('common.discardTitle'),
  message: t('common.discardBody'),
  confirmLabel: t('common.discardOk'),
  cancelLabel: t('common.discardKeep'),
  danger: true,
});
