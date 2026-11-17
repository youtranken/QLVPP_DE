import { useEffect, useState, type CSSProperties } from 'react';
import type { Tone } from '@/lib/group-tone';
import { categoryIcon, type CategoryIcon } from '@/lib/category-icon';
import { Icon, type IconName } from './icon';

const ICON_OF: Record<CategoryIcon, IconName> = { pen: 'pen', paper: 'paper', clip: 'clip', folder: 'folder', box: 'pkg' };

export type ThumbSize = 34 | 36 | 40 | 42 | 48 | 56 | 96 | 120 | 'card' | 'tile';

// Cỡ co giãn theo ô, cả hai khung 1:1 để ảnh một món trông như nhau ở Danh mục và Đăng ký; tile bo nhỏ hơn
const FLUID = {
  card: { aspectRatio: '1 / 1' as const, height: undefined, radius: undefined, img: undefined },
  tile: { aspectRatio: '1 / 1' as const, height: undefined, radius: 14, img: undefined },
};

// Ảnh có thể dính 429/lỗi mạng thoáng qua → thử lại tối đa 2 lần (500 ms, 1500 ms), tham số ?r=n chỉ thêm khi thử lại
const RETRY_DELAYS_MS = [500, 1500];

// Chưa có ảnh → biểu tượng theo nhóm (category = tên nhóm) trên nền tông nhóm; món ngoài danh mục → ô "?" viền đứt
export function ItemThumb({ fileId, alt, tone, size, category, custom = false }: { fileId: string | null; alt: string; tone: Tone; size: ThumbSize; category?: string | null; custom?: boolean }) {
  const [failedId, setFailedId] = useState<string | null>(null);
  const [retry, setRetry] = useState({ id: fileId, n: 0, waiting: false });
  const attempt = retry.id === fileId ? retry.n : 0;
  const waiting = retry.id === fileId && retry.waiting;
  useEffect(() => {
    if (!waiting) return;
    const timer = setTimeout(() => setRetry({ id: fileId, n: attempt + 1, waiting: false }), RETRY_DELAYS_MS[attempt]);
    return () => clearTimeout(timer);
  }, [waiting, attempt, fileId]);
  const onError = () => {
    if (attempt < RETRY_DELAYS_MS.length) setRetry({ id: fileId, n: attempt, waiting: true });
    else setFailedId(fileId);
  };
  // Đang chờ thử lại: hiện khung giữ chỗ thay ảnh vỡ/chữ alt
  const showImg = fileId != null && failedId !== fileId && !waiting;
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
          src={attempt > 0 ? `/api/files/${fileId}?r=${attempt}` : `/api/files/${fileId}`}
          alt={alt}
          loading="lazy"
          onError={onError}
          style={{ ...(shape?.img ?? { width: '78%', height: '78%' }), maxWidth: '88%', objectFit: 'contain', filter: 'drop-shadow(0 8px 12px rgb(var(--sh-ink) / .18))' }}
        />
      </span>
    );
  }
  const iconSize = px ? Math.round(px * 0.45) : 40;
  if (custom) {
    return (
      <span data-thumb="custom" aria-hidden="true" style={{ ...box, background: 'var(--c-surface)', border: '1.5px dashed var(--c-line-input)', color: 'var(--c-muted)', font: 'var(--t-label)', fontSize: iconSize }}>
        ?
      </span>
    );
  }
  const icon = categoryIcon(category);
  return (
    <span data-thumb="placeholder" data-icon={icon} style={{ ...box, color: 'var(--c-ink-2)' }}>
      <Icon name={ICON_OF[icon]} size={iconSize} />
    </span>
  );
}
