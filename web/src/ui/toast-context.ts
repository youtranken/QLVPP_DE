import { createContext, useContext } from 'react';

export interface ToastSpec {
  text: string;
  tone?: 'ok' | 'info' | 'warn' | 'danger';
  action?: { label: string; onClick: () => void };
}

export interface ToastApi {
  show: (toast: ToastSpec) => void;
}

export const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error('useToast needs ToastProvider');
  return api;
}
