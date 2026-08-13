import { describe, expect, it } from 'vitest';
import { periodLabel } from './format';

describe('periodLabel', () => {
  it('hiển thị kỳ tiếng Việt', () => {
    expect(periodLabel('2026-08')).toBe('Tháng 8/2026');
  });
});
