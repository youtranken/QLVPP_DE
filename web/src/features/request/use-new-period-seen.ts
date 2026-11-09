import { useCallback } from 'react';

const key = (sub: string, ym: string) => `vpp_newperiod_seen:${sub}:${ym}`;

// Popup kỳ mới chỉ hiện một lần cho mỗi người mỗi kỳ. Không đọc/ghi được localStorage thì coi như đã xem để khỏi làm phiền
export function readNewPeriodSeen(sub: string, ym: string): boolean {
  try {
    return localStorage.getItem(key(sub, ym)) !== null;
  } catch {
    return true;
  }
}

export function useNewPeriodSeen(sub: string, ym: string) {
  const mark = useCallback(() => {
    try {
      localStorage.setItem(key(sub, ym), '1');
    } catch {
      // bỏ qua: lần sau đọc lỗi cũng coi như đã xem
    }
  }, [sub, ym]);
  return { mark };
}
