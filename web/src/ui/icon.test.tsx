import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Icon } from './icon';
import { IconSprite } from './icon-sprite';

describe('Icon', () => {
  it('render use#u-truck và aria-hidden', () => {
    const { container } = render(<Icon name="truck" />);
    const svg = container.querySelector('svg')!;
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect(container.querySelector('use')!.getAttribute('href')).toBe('#u-truck');
    expect(svg.getAttribute('width')).toBe('20');
  });
  it('size tùy chỉnh', () => {
    const { container } = render(<Icon name="x" size={16} />);
    expect(container.querySelector('svg')!.getAttribute('width')).toBe('16');
  });
});

describe('IconSprite', () => {
  it('có đủ 45 symbol u-* và ẩn', () => {
    const { container } = render(<IconSprite />);
    expect(container.querySelector('svg')!.style.display).toBe('none');
    expect(container.querySelectorAll('symbol[id^="u-"]')).toHaveLength(45);
  });
});
