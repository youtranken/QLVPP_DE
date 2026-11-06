import { useState, type CSSProperties } from 'react';
import type { Tone } from '@/lib/group-tone';
import { Icon } from './icon';

export type ThumbSize = 34 | 36 | 40 | 42 | 48 | 96 | 120 | 'card' | 'tile';

// Cỡ co giãn theo ô, cả hai khung 1:1 để ảnh một món trông như nhau ở Danh mục và Đăng ký; tile bo nhỏ hơn
const FLUID = {
  card: { aspectRatio: '1 / 1' as const, height: undefined, radius: undefined, img: undefined },
  tile: { aspectRatio: '1 / 1' as const, height: undefined, radius: 14, img: undefined },
};

export function ItemThumb({ fileId, alt, tone, size }: { fileId: string | null; alt: string; tone: Tone; size: ThumbSize }) {
  const [failedId, setFailedId] = useState<string | null>(null);
  const showImg = fileId != null && failedId !== fileId;
  const px = typeof size === 'number' ? size : undefined;
  const shape = FLUID[size as 'card' | 'tile'];
  const box: CSSProperties = {
    display: 'grid',
    placeItems: 'center',
    flex: 'none',
    width: px ?? '100%',
    height: shape?.height ?? px,
    aspectRatio: shape?.aspectRatio,
    background: `var(--${tone})`,
    borderRadius: px !== undefined && px <= 48 ? 'var(--r-sm)' : shape?.radius ?? 'var(--r-lg)',
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
          style={{ ...(shape?.img ?? { width: '78%', height: '78%' }), maxWidth: '88%', objectFit: 'contain', filter: 'drop-shadow(0 8px 12px rgb(var(--sh-ink) / .18))' }}
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
