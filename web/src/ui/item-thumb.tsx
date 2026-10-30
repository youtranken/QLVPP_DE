import { useState } from 'react';
import type { Tone } from '@/lib/group-tone';
import { Icon } from './icon';

export type ThumbSize = 34 | 36 | 48 | 96 | 'card';

export function ItemThumb({ fileId, alt, tone, size }: { fileId: string | null; alt: string; tone: Tone; size: ThumbSize }) {
  const [failedId, setFailedId] = useState<string | null>(null);
  const showImg = fileId != null && failedId !== fileId;
  const px = size === 'card' ? undefined : size;
  const box: React.CSSProperties = {
    display: 'grid',
    placeItems: 'center',
    flex: 'none',
    width: px ?? '100%',
    height: px,
    aspectRatio: px ? undefined : '1 / 1',
    background: `var(--${tone})`,
    borderRadius: px !== undefined && px <= 48 ? 'var(--r-sm)' : 'var(--r-lg)',
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
          style={{ width: '78%', height: '78%', objectFit: 'contain', filter: 'drop-shadow(0 8px 12px rgb(var(--sh-ink) / .18))' }}
        />
      </span>
    );
  }
  return (
    <span data-thumb="placeholder" style={{ ...box, background: 'var(--g0)', color: 'var(--c-faint)' }}>
      <Icon name="image" size={px ? Math.round(px * 0.4) : 40} />
    </span>
  );
}
