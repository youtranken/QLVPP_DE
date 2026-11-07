import { describe, expect, it } from 'vitest';
import { renderWithI18n, screen } from '@/test/test-utils';
import { PausedStamp } from './paused-stamp';

describe('PausedStamp', () => {
  it('con dấu có nhãn "Tạm ngưng" đọc được (role img)', () => {
    renderWithI18n(<PausedStamp />);
    expect(screen.getByRole('img', { name: 'Tạm ngưng' })).toHaveTextContent('Tạm ngưng');
  });
});
