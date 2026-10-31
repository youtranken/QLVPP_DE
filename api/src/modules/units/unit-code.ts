export const UNIT_CODE_MAX = 32;
const FALLBACK = 'dvt';

function slug(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const fit = (base: string, max: number) =>
  base.slice(0, max).replace(/-+$/, '') || FALLBACK;

export function unitCodeFrom(name: string, taken: ReadonlySet<string>): string {
  const base = fit(slug(name), UNIT_CODE_MAX);
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) {
    const suffix = `-${n}`;
    const code = fit(base, UNIT_CODE_MAX - suffix.length) + suffix;
    if (!taken.has(code)) return code;
  }
}
