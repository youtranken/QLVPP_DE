import type { CSSProperties } from 'react';
import { EMPTY_ART } from './empty-art-paths';

export type EmptyArtKind = keyof typeof EMPTY_ART;

export function EmptyArt({ kind }: { kind: EmptyArtKind }) {
  return (
    <svg
      width="160"
      height="120"
      viewBox="0 0 160 120"
      aria-hidden="true"
      focusable={false}
      style={{ '--p': 'var(--ill-paper)', '--o': 'var(--ill-line)', '--l': 'var(--ill-rule)' } as CSSProperties}
      dangerouslySetInnerHTML={{ __html: EMPTY_ART[kind] }}
    />
  );
}
