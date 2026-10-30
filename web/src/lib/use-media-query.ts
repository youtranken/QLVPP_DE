import { useSyncExternalStore } from 'react';

export const NARROW_QUERY = '(max-width: 900px)';
export const ADMIN_PHONE_QUERY = '(max-width: 767px)';
export const ADMIN_TABLET_QUERY = '(min-width: 768px) and (max-width: 1279px)';
export const ADMIN_WIDE_QUERY = '(min-width: 1440px)';

function mql(query: string): MediaQueryList | null {
  return typeof window.matchMedia === 'function' ? window.matchMedia(query) : null;
}

export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const m = mql(query);
      m?.addEventListener('change', onChange);
      return () => m?.removeEventListener('change', onChange);
    },
    () => mql(query)?.matches ?? false,
  );
}
