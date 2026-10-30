import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, renderWithI18n, screen, userEvent, waitFor } from '@/test/test-utils';
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

  it('Enter trong ô tìm gọi onEnter nếu có, vẫn không tự submit form', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(jsonResponse(200, { items: [], next_cursor: null }))));
    const onSubmit = vi.fn((e: { preventDefault: () => void }) => e.preventDefault());
    const onEnter = vi.fn();
    renderWithI18n(
      <form onSubmit={onSubmit}>
        <UserPicker label="Người thực hiện" searchLabel="Tìm người" value={null} onChange={vi.fn()} onEnter={onEnter} />
      </form>,
    );
    await userEvent.type(screen.getByRole('searchbox', { name: 'Tìm người' }), 'lan{Enter}');
    expect(onEnter).toHaveBeenCalledTimes(1);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('excludeAdmin gửi exclude_admin=true; mặc định không gửi cờ', async () => {
    const fetchMock = vi.fn(() => Promise.resolve(jsonResponse(200, { items: [], next_cursor: null })));
    vi.stubGlobal('fetch', fetchMock);
    const urls = () => (fetchMock.mock.calls as unknown as [string][]).map(([u]) => u);
    const { unmount } = renderWithI18n(
      <UserPicker label="A" searchLabel="Tìm A" value={null} onChange={vi.fn()} excludeAdmin />,
    );
    await waitFor(() => expect(urls().some((u) => u.includes('exclude_admin=true'))).toBe(true));
    unmount();
    fetchMock.mockClear();
    renderWithI18n(<UserPicker label="B" searchLabel="Tìm B" value={null} onChange={vi.fn()} />);
    await waitFor(() => expect(urls().length).toBeGreaterThan(0));
    expect(urls().some((u) => u.includes('exclude_admin'))).toBe(false);
  });
});
