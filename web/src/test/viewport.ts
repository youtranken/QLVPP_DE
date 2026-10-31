import { vi } from 'vitest';

// jsdom không có matchMedia: giả lập theo bề ngang để test hành vi ≤ 900 px
export function mockViewport(width: number, { reducedMotion = false } = {}): void {
  vi.stubGlobal('matchMedia', (query: string) => {
    if (query.includes('prefers-reduced-motion')) return mediaList(query, reducedMotion);
    const max = /max-width:\s*(\d+)px/.exec(query);
    const min = /min-width:\s*(\d+)px/.exec(query);
    return mediaList(query, (!max || width <= Number(max[1])) && (!min || width >= Number(min[1])));
  });
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
