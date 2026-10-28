import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, renderWithI18n, screen, userEvent } from '@/test/test-utils';
import { UserPicker } from './user-picker';

afterEach(() => vi.unstubAllGlobals());

describe('UserPicker', () => {
  it('Enter trong ô tìm người không submit form chứa nó', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(jsonResponse(200, { items: [], next_cursor: null }))));
    const onSubmit = vi.fn((e: { preventDefault: () => void }) => e.preventDefault());
    renderWithI18n(
      <form onSubmit={onSubmit}>
        <UserPicker label="Người nhận" searchLabel="Tìm người nhận" value={null} onChange={vi.fn()} />
        <button type="submit">Lưu</button>
      </form>,
    );
    await userEvent.type(screen.getByRole('searchbox', { name: 'Tìm người nhận' }), 'lan{Enter}');
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
