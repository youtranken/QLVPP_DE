import { useCallback, useSyncExternalStore } from 'react';

export const NARROW_QUERY = '(max-width: 900px)';
// Điện thoại (cả hai khung): dưới 768 px
export const PHONE_QUERY = '(max-width: 767px)';
export const ADMIN_PHONE_QUERY = PHONE_QUERY;
export const ADMIN_TABLET_QUERY = '(min-width: 768px) and (max-width: 1279px)';

function mql(query: string): MediaQueryList | null {
  return typeof window.matchMedia === 'function' ? window.matchMedia(query) : null;
}

export function useMediaQuery(query: string): boolean {
  // subscribe ổn định theo query: hàm mới mỗi lần vẽ khiến React gỡ rồi nghe lại listener mỗi lần vẽ
  const subscribe = useCallback(
    (onChange: () => void) => {
      const m = mql(query);
      m?.addEventListener('change', onChange);
      return () => m?.removeEventListener('change', onChange);
    },
    [query],
  );
  return useSyncExternalStore(subscribe, () => mql(query)?.matches ?? false);
}
