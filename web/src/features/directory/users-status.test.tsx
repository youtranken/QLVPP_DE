import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, userEvent, waitFor, within, pickOption, optionLabels } from '@/test/test-utils';
import { renderApp } from '@/test/render-app';
import { makeMe } from '@/test/fixtures-me';
import { mockViewport } from '@/test/viewport';
import { AN, BINH, CHI, DEL, DUNG, openUsers, regOf, stubUsers } from './users-fixtures';

const card = (name: RegExp) => screen.getByRole('tab', { name });
const bodyRows = () => within(screen.getByRole('table')).getAllByRole('row').slice(1);

afterEach(() => vi.unstubAllGlobals());

// Ô Trạng thái của Danh bạ: mặc định Đang dùng, người khóa/mất quyền/đã xóa chỉ hiện khi chọn
describe('UsersPage — lọc trạng thái', () => {
  it('mặc định chỉ hiện người Đang dùng (ô Trạng thái chọn sẵn); Mọi trạng thái hiện cả người khóa, nhãn đỏ "Đã khóa", dòng mờ', async () => {
    stubUsers([AN, BINH, CHI, DUNG]);
    await openUsers();
    const status = screen.getByRole('combobox', { name: 'Trạng thái' });
    expect(status).toHaveTextContent('Đang dùng');
    expect(await optionLabels(status)).toEqual(['Mọi trạng thái', 'Đang dùng', 'Đã khóa', 'Mất quyền', 'Đã xóa']);
    await userEvent.keyboard('{Escape}');
    expect(bodyRows().map((r) => within(r).getByRole('button').textContent)).toEqual(['Phạm Minh Đức', 'Trần Chi']);
    expect(screen.queryByText('Lê Thị Bình')).toBeNull();
    // Thẻ Đang dùng đang chọn đã nói đúng số người: không thêm "Đang hiện 2/4 người"
    expect(screen.queryByText(/^Đang hiện/)).toBeNull();
    // Mặc định không phải "đang lọc" — không có dòng Đang lọc/Xóa lọc
    expect(screen.queryByText(/^Đang lọc:/)).toBeNull();
    await pickOption(status, 'Mọi trạng thái');
    expect(screen.getByTestId('location-search')).toHaveTextContent('status=all');
    expect(bodyRows()).toHaveLength(4);
    const binh = screen.getByText('Lê Thị Bình').closest('tr')!;
    expect(within(binh).getByText('Đã khóa')).toHaveClass('tag', 'tag--danger');
    expect(binh).toHaveClass('is-inactive');
    await pickOption(status, 'Đã khóa');
    expect(bodyRows().map((r) => within(r).getByRole('button').textContent)).toEqual(['Lê Thị Bình']);
    expect(card(/^Đã khóa/)).toHaveAttribute('aria-selected', 'true');
  });

  it('người đã xóa ẩn mặc định; chọn "Đã xóa" mới thấy, nhãn Đã xóa, và quay lại thì ẩn', async () => {
    stubUsers([AN, BINH, DEL]);
    await openUsers();
    expect(screen.queryByText('Hà Đã Xoá')).toBeNull();
    const view = screen.getByRole('combobox', { name: 'Trạng thái' });
    await pickOption(view, 'Đã xóa');
    expect(await screen.findByText('Hà Đã Xoá')).toBeInTheDocument();
    expect(bodyRows()).toHaveLength(1);
    expect(within(bodyRows()[0]).getByText('Đã xóa')).toBeInTheDocument();
    await pickOption(view, 'Đang dùng');
    await waitFor(() => expect(screen.queryByText('Hà Đã Xoá')).toBeNull());
    expect(screen.getByText('Phạm Minh Đức')).toBeInTheDocument();
  });

  it('bấm thẻ Chưa đặt phiếu: một thẻ sáng, số dòng = số trên thẻ (kể cả người đã khóa chưa đăng ký); bấm lại → về mặc định', async () => {
    stubUsers([AN, BINH, CHI, DUNG], undefined, regOf([CHI, BINH], ['u-an']));
    await openUsers();
    const reg = await screen.findByRole('tab', { name: /^Chưa đặt phiếu tháng 11/ });
    await waitFor(() => expect(reg).toHaveTextContent(/2\s*người/));
    await userEvent.click(reg);
    expect(new URLSearchParams(screen.getByTestId('location-search').textContent ?? '').get('status')).toBe('all');
    expect(reg).toHaveAttribute('aria-selected', 'true');
    expect(screen.getAllByRole('tab', { selected: true })).toEqual([reg]);
    expect(bodyRows().map((r) => within(r).getAllByRole('button')[0].textContent).sort()).toEqual(['Lê Thị Bình', 'Trần Chi']);
    await userEvent.click(reg);
    expect(screen.getByTestId('location-search')).not.toHaveTextContent(/status=|reg=/);
    expect(card(/^Đang dùng/)).toHaveAttribute('aria-selected', 'true');
  });

  it.each([
    ['status=all (rộng hơn mặc định)', 'status=all', false],
    ['status=locked (hẹp hơn)', 'status=locked', true],
  ])('danh bạ chỉ có người Đã xóa, %s → nút Xóa lọc %s', async (_n, query, offered) => {
    stubUsers([DEL]);
    mockViewport(1280);
    renderApp(makeMe('admin'), `/admin/users?${query}`);
    expect(await screen.findByText(/^Không có ai khớp/)).toBeInTheDocument();
    expect(screen.queryAllByRole('button', { name: 'Xóa lọc' }).length > 0).toBe(offered);
  });

  it('danh bạ tràn (> 2000, lọc ở server): mặc định gửi status=active; chọn Đã khóa → gửi status=locked', async () => {
    const many = Array.from({ length: 2001 }, (_, i) => ({ ...CHI, sub: `u-${i}`, fullName: `Người ${String(i).padStart(4, '0')}` }));
    const f = stubUsers([AN, ...many, BINH]);
    mockViewport(1280);
    renderApp(makeMe('admin'), '/admin/users');
    await screen.findByText('Người 0000');
    const statusOf = () =>
      f.mock.calls
        .map(([u]) => new URL(String(u), 'http://x'))
        .filter((u) => u.pathname === '/api/admin/users' && !u.searchParams.has('cursor'))
        .map((u) => u.searchParams.get('status'));
    expect(statusOf()).toContain('active');
    await pickOption(screen.getByRole('combobox', { name: 'Trạng thái' }), 'Đã khóa');
    await waitFor(() => expect(statusOf()).toContain('locked'));
  });
});
