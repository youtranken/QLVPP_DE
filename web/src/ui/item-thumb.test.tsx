import { act, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ItemThumb } from './item-thumb';

describe('ItemThumb', () => {
  it('có fileId → img /api/files/:id với alt đúng', () => {
    const { container } = render(<ItemThumb fileId="f1" alt="Bút bi" tone="g1" size={48} />);
    const img = container.querySelector('img[src="/api/files/f1"]')!;
    expect(img.getAttribute('alt')).toBe('Bút bi');
    expect(img.getAttribute('loading')).toBe('lazy');
  });
  it('ảnh lỗi hết lần thử lại → bỏ img, hiện placeholder', () => {
    const { container } = render(<ItemThumb fileId="f1" alt="Bút bi" tone="g1" size={48} />);
    vi.useFakeTimers();
    for (const wait of [500, 1500]) {
      fireEvent.error(container.querySelector('img')!);
      act(() => { vi.advanceTimersByTime(wait); });
    }
    fireEvent.error(container.querySelector('img')!);
    vi.useRealTimers();
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
    vi.useFakeTimers();
    const { container, rerender } = render(<ItemThumb fileId="f1" alt="a" tone="g1" size={48} />);
    for (const wait of [500, 1500]) {
      fireEvent.error(container.querySelector('img')!);
      act(() => { vi.advanceTimersByTime(wait); });
    }
    fireEvent.error(container.querySelector('img')!);
    vi.useRealTimers();
    rerender(<ItemThumb fileId="f2" alt="a" tone="g1" size={48} />);
    expect(container.querySelector('img[src="/api/files/f2"]')).not.toBeNull();
  });
  describe('thử lại khi lỗi tải (429)', () => {
    afterEach(() => vi.useRealTimers());
    it('lỗi → chờ 500 ms rồi thử lại với ?r=1; lần sau thành công thì vẫn là img', () => {
      vi.useFakeTimers();
      const { container } = render(<ItemThumb fileId="f1" alt="a" tone="g1" size={48} />);
      expect(container.querySelector('img')!.getAttribute('src')).toBe('/api/files/f1');
      fireEvent.error(container.querySelector('img')!);
      act(() => { vi.advanceTimersByTime(499); });
      // Trong lúc chờ: khung giữ chỗ, không để ảnh vỡ/alt hiện ra
      expect(container.querySelector('img')).toBeNull();
      expect(container.querySelector('[data-thumb="placeholder"]')).not.toBeNull();
      act(() => { vi.advanceTimersByTime(1); });
      expect(container.querySelector('img')!.getAttribute('src')).toBe('/api/files/f1?r=1');
      fireEvent.load(container.querySelector('img')!);
      act(() => { vi.advanceTimersByTime(5000); });
      expect(container.querySelector('img')!.getAttribute('src')).toBe('/api/files/f1?r=1');
    });
    it('lỗi liên tục: thử lại lần 2 sau 1500 ms (?r=2), lỗi lần 3 → placeholder', () => {
      vi.useFakeTimers();
      const { container } = render(<ItemThumb fileId="f1" alt="a" tone="g1" size={48} />);
      fireEvent.error(container.querySelector('img')!);
      act(() => { vi.advanceTimersByTime(500); });
      fireEvent.error(container.querySelector('img')!);
      act(() => { vi.advanceTimersByTime(1499); });
      expect(container.querySelector('img')).toBeNull();
      act(() => { vi.advanceTimersByTime(1); });
      expect(container.querySelector('img')!.getAttribute('src')).toBe('/api/files/f1?r=2');
      fireEvent.error(container.querySelector('img')!);
      expect(container.querySelector('img')).toBeNull();
      expect(container.querySelector('[data-thumb="placeholder"]')).not.toBeNull();
    });
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
