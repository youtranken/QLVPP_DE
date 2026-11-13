import type { SVGProps } from 'react';
import type { ICON_PATHS } from './icon-paths';

const STROKE: SVGProps<SVGSVGElement> = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' };

export type IconName = keyof typeof ICON_PATHS;

export function Icon({ name, size = 20, className }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable={false} {...STROKE}>
      <use href={`#u-${name}`} />
    </svg>
  );
}
