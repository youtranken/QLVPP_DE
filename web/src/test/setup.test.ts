import { describe, expect, it } from 'vitest';
import { getConfig } from '@testing-library/react';

// Chặn tái phát L3: findBy/waitFor không được về lại 1 s mặc định (rơi ngẫu nhiên khi máy tải)
describe('setup test', () => {
  it('asyncUtilTimeout của Testing Library = 3000 ms', () => {
    expect(getConfig().asyncUtilTimeout).toBe(3000);
  });
});
