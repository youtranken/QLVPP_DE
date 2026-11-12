import { describe, expect, it } from 'vitest';
import { renderWithI18n, screen } from '@/test/test-utils';
import { UsersStats } from './users-stats';

describe('UsersStats: thẻ Đã khóa và Mất quyền khác màu', () => {
  it('Đã khóa > 0 → danger; Mất quyền > 0 → info (không cùng đỏ)', () => {
    renderWithI18n(<UsersStats stats={{ active: 9, locked: 1, no_access: 2 }} filter={null} onFilter={() => {}} reg={null} />);
    const tone = (label: string) => screen.getByText(label).closest('.stat-card')!.getAttribute('data-tone');
    expect(tone('Đã khóa')).toBe('danger');
    expect(tone('Mất quyền')).toBe('info');
  });
});
