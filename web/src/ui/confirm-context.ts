import { createContext, useContext, type ReactNode } from 'react';

export type ConfirmOptions = {
  message: string;
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  // Khối cam không chặn (W…): nút chính vẫn bấm được
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

// Panel phủ: hộp chọn giữa hai lựa chọn nên nút thoát là "Ở lại", không phải "Tiếp tục sửa"
export const panelDiscardOptions = (t: (key: string) => string): ConfirmOptions => ({
  title: t('common.panel.discardTitle'),
  message: t('common.discardBody'),
  confirmLabel: t('common.discardOk'),
  cancelLabel: t('common.panel.stay'),
  danger: true,
});
