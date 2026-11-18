import { createContext, useContext } from 'react';

export interface ToastSpec {
  text: string;
  tone?: 'ok' | 'info' | 'warn' | 'danger';
  action?: { label: string; onClick: () => void };
  // Ở lại tới khi chủ toast gỡ (dismiss) hoặc người dùng bấm nút: dùng khi nút là lối duy nhất để làm tiếp
  persist?: boolean;
  // Hoàn tác 5 giây: nút "Hoàn tác (n)" đếm ngược, không dừng khi rê chuột vì cửa sổ do server tính
  undo?: () => Promise<unknown>;
  // Mốc (Date.now) server bắt đầu tính 5 giây; thao tác nhiều bước truyền giờ gửi bước đầu để nút tắt không muộn hơn server
  undoSince?: number;
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
