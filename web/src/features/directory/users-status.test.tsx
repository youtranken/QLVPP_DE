import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, userEvent, waitFor, within, pickOption, optionLabels } from '@/test/test-utils';
import { AN, BINH, CHI, DEL, DUNG, openUsers, stubUsers } from './users-fixtures';

const card = (name: RegExp) => screen.getByRole('button', { name });
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
    expect(screen.getByText('Đang hiện 2/4 người')).toBeInTheDocument();
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
    expect(card(/^Đã khóa/)).toHaveAttribute('aria-pressed', 'true');
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
});
