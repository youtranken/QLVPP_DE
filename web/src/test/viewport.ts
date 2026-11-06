import { vi } from 'vitest';

// jsdom không có matchMedia: giả lập theo bề ngang để test hành vi ≤ 900 px
export function mockViewport(width: number, { reducedMotion = false } = {}): void {
  vi.stubGlobal('matchMedia', (query: string) => {
    if (query.includes('prefers-reduced-motion')) return mediaList(query, reducedMotion);
    return mediaList(query, widthMatches(query, width));
  });
}

// Bề ngang đổi được giữa test (xoay máy/kéo cửa sổ): báo 'change' cho mọi listener đang nghe
export function mockResizableViewport(initial: number): (width: number) => void {
  let width = initial;
  const listeners = new Set<() => void>();
  vi.stubGlobal('matchMedia', (query: string) => ({
    ...mediaList(query, false),
    get matches() {
      return !query.includes('prefers-reduced-motion') && widthMatches(query, width);
    },
    addEventListener: (_: string, fn: () => void) => listeners.add(fn),
    removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
  }));
  return (next) => {
    width = next;
    listeners.forEach((fn) => fn());
  };
}

function widthMatches(query: string, width: number): boolean {
  const max = /max-width:\s*(\d+)px/.exec(query);
  const min = /min-width:\s*(\d+)px/.exec(query);
  return (!max || width <= Number(max[1])) && (!min || width >= Number(min[1]));
}

function mediaList(media: string, matches: boolean): MediaQueryList {
  return {
    matches,
    media,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  } as MediaQueryList;
}
