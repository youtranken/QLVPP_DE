import type { SVGProps } from 'react';
import type { ICON_PATHS } from './icon-paths';

const STROKE: SVGProps<SVGSVGElement> = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' };

export type IconName = keyof typeof ICON_PATHS;

export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable={false} {...STROKE}>
      <use href={`#u-${name}`} />
    </svg>
  );
}
