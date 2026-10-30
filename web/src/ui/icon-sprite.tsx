import type { SVGProps } from 'react';
import { ICON_PATHS } from './icon-paths';

const SYMBOLS = Object.entries(ICON_PATHS)
  .map(([name, d]) => `<symbol id="u-${name}" viewBox="0 0 24 24">${d}</symbol>`)
  .join('');

const STROKE: SVGProps<SVGSVGElement> = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' };

export function IconSprite() {
  return <svg aria-hidden style={{ display: 'none' }} {...STROKE} dangerouslySetInnerHTML={{ __html: `<defs>${SYMBOLS}</defs>` }} />;
}
