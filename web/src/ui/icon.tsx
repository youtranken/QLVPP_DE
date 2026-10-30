import type { ICON_PATHS } from './icon-paths';

export type IconName = keyof typeof ICON_PATHS;

export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable={false}>
      <use href={`#u-${name}`} />
    </svg>
  );
}
