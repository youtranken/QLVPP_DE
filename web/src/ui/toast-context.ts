import { createContext, useContext } from 'react';

export interface ToastSpec {
  text: string;
  tone?: 'ok' | 'info' | 'warn' | 'danger';
  action?: { label: string; onClick: () => void };
  // Ở lại tới khi chủ toast gỡ (dismiss) hoặc người dùng bấm nút: dùng khi nút là lối duy nhất để làm tiếp
  persist?: boolean;
}

export interface ToastApi {
  show: (toast: ToastSpec) => void;
  // Gỡ đúng toast này nếu nó còn hiện (toast khác đã thay thì thôi)
  dismiss: (toast: ToastSpec) => void;
}

export const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error('useToast needs ToastProvider');
  return api;
}
