import { useState, type CSSProperties } from 'react';
import type { Tone } from '@/lib/group-tone';
import { Icon } from './icon';

export type ThumbSize = 34 | 36 | 48 | 96 | 120 | 'card' | 'tile';

export function ItemThumb({ fileId, alt, tone, size }: { fileId: string | null; alt: string; tone: Tone; size: ThumbSize }) {
  const [failedId, setFailedId] = useState<string | null>(null);
  const showImg = fileId != null && failedId !== fileId;
  const fluid = size === 'card' || size === 'tile';
  const px = fluid ? undefined : size;
  const box: CSSProperties = {
    display: 'grid',
    placeItems: 'center',
    flex: 'none',
    width: px ?? '100%',
    height: size === 'tile' ? 120 : px,
    aspectRatio: fluid && size !== 'tile' ? '1 / 1' : undefined,
    background: `var(--${tone})`,
    borderRadius: px !== undefined && px <= 48 ? 'var(--r-sm)' : size === 'tile' ? 14 : 'var(--r-lg)',
    overflow: 'hidden',
  };
  if (showImg) {
    return (
      <span style={box}>
        <img
          src={`/api/files/${fileId}`}
          alt={alt}
          loading="lazy"
          onError={() => setFailedId(fileId)}
          style={{ width: size === 'tile' ? 'auto' : '78%', height: size === 'tile' ? '88%' : '78%', maxWidth: '88%', objectFit: 'contain', filter: 'drop-shadow(0 8px 12px rgb(var(--sh-ink) / .18))' }}
        />
      </span>
    );
  }
  return (
    <span data-thumb="placeholder" style={{ ...box, color: 'var(--c-faint)' }}>
      <Icon name="image" size={px ? Math.round(px * 0.4) : 40} />
    </span>
  );
}
