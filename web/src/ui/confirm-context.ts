import { createContext, useContext } from 'react';

export type ConfirmOptions = {
  message: string;
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
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
