import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ItemThumb } from './item-thumb';

describe('ItemThumb', () => {
  it('có fileId → img /api/files/:id với alt đúng', () => {
    const { container } = render(<ItemThumb fileId="f1" alt="Bút bi" tone="g1" size={48} />);
    const img = container.querySelector('img[src="/api/files/f1"]')!;
    expect(img.getAttribute('alt')).toBe('Bút bi');
    expect(img.getAttribute('loading')).toBe('lazy');
  });
  it('ảnh lỗi → bỏ img, hiện placeholder', () => {
    const { container } = render(<ItemThumb fileId="f1" alt="Bút bi" tone="g1" size={48} />);
    fireEvent.error(container.querySelector('img')!);
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('[data-thumb="placeholder"]')).not.toBeNull();
  });
  it('fileId null → placeholder, không img', () => {
    const { container } = render(<ItemThumb fileId={null} alt="" tone="g0" size={34} />);
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('[data-thumb="placeholder"] use')!.getAttribute('href')).toBe('#u-image');
  });
  it('placeholder lấy tông nhóm của món (không luôn g0)', () => {
    const { container } = render(<ItemThumb fileId={null} alt="" tone="g3" size="card" />);
    expect((container.querySelector('[data-thumb="placeholder"]') as HTMLElement).style.background).toBe('var(--g3)');
  });
  it('đổi fileId sau khi lỗi thì thử lại ảnh mới', () => {
    const { container, rerender } = render(<ItemThumb fileId="f1" alt="a" tone="g1" size={48} />);
    fireEvent.error(container.querySelector('img')!);
    rerender(<ItemThumb fileId="f2" alt="a" tone="g1" size={48} />);
    expect(container.querySelector('img[src="/api/files/f2"]')).not.toBeNull();
  });
  it('thẻ Đăng ký (tile) và thẻ Danh mục (card) cùng món: cùng src, khung 1:1, ảnh object-fit contain', () => {
    const tile = render(<ItemThumb fileId="f9" alt="" tone="g1" size="tile" />).container;
    const card = render(<ItemThumb fileId="f9" alt="Bút bi" tone="g1" size="card" />).container;
    for (const c of [tile, card]) {
      const img = c.querySelector('img') as HTMLImageElement;
      expect(img.getAttribute('src')).toBe('/api/files/f9');
      expect(img.style.objectFit).toBe('contain');
      expect((img.parentElement as HTMLElement).style.aspectRatio).toBe('1 / 1');
    }
  });
});
