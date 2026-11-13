import { describe, expect, it, vi } from 'vitest';
import type { SizeOptions } from '@floating-ui/react';
import { popoverFit } from './popover-fit';

// middleware của @floating-ui/react giữ tùy chọn ở options[0]
const optionsOf = (mw: { options?: unknown }) => (mw.options as unknown[])[0] as Record<string, unknown>;

describe('popoverFit — popover neo ô luôn nằm trọn trong màn', () => {
  it('thứ tự offset → flip → size → shift; shift cả trục dọc (lịch 430px ở 390×800 từng bị cắt 14px trên đỉnh)', () => {
    const mws = popoverFit();
    expect(mws.map((m) => m.name)).toEqual(['offset', 'flip', 'size', 'shift']);
    expect(optionsOf(mws[3])).toMatchObject({ crossAxis: true, padding: 8 });
    expect(optionsOf(mws[1])).toMatchObject({ padding: 8 });
  });

  it('size: không cao quá màn trừ hai lề, rồi mới tới apply riêng của nơi gọi (Listbox siết theo chỗ còn lại)', () => {
    const inner = vi.fn(({ elements }: Parameters<NonNullable<SizeOptions['apply']>>[0]) => {
      elements.floating.style.minWidth = '120px';
    });
    const size = popoverFit({ edge: 10, apply: inner })[2];
    const floating = document.createElement('div');
    const state = { elements: { floating }, availableHeight: 200, availableWidth: 300, rects: { reference: { width: 120 } } };
    Object.defineProperty(document.documentElement, 'clientHeight', { configurable: true, value: 640 });
    try {
      (optionsOf(size) as SizeOptions).apply!(state as unknown as Parameters<NonNullable<SizeOptions['apply']>>[0]);
    } finally {
      Object.defineProperty(document.documentElement, 'clientHeight', { configurable: true, value: 0 });
    }
    expect(floating.style.maxHeight).toBe('620px');
    expect(inner).toHaveBeenCalledOnce();
    expect(floating.style.minWidth).toBe('120px');
  });
});
