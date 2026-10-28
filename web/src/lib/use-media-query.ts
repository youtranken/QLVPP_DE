import { useSyncExternalStore } from 'react';

export const NARROW_QUERY = '(max-width: 900px)';

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
