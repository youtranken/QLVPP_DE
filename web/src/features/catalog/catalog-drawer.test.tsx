import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, userEvent, waitFor, within } from '@/test/test-utils';
import { PAPER, PEN, PENCIL } from './catalog-fixtures';
import { locationSearch, openCatalog, rowOf } from './catalog-fixtures-api';

const ITEMS = [PAPER, PEN, PENCIL];
const location = locationSearch;

afterEach(() => vi.unstubAllGlobals());

describe('Danh mục — panel phủ món', () => {
  it('bấm hàng → ?item=<id>, ngăn kéo tên món, hàng đang mở được đánh dấu', async () => {
    await openCatalog({ items: ITEMS });
    const row = rowOf('Bút bi xanh');
    await userEvent.click(within(row).getByText('Bút bi xanh'));
    expect(location()).toBe(`?item=${PEN.id}`);
    expect(await screen.findByRole('dialog', { name: 'Sửa món Bút bi xanh' })).toBeInTheDocument();
    expect(row).toHaveAttribute('aria-current', 'true');
  });

  it('"Món sau" đi theo thứ tự hàng đang thấy (Giấy A4 → Bút bi xanh → Bút chì 2B); món cuối không có "Món sau"', async () => {
    await openCatalog({ items: ITEMS }, `/admin/catalog?item=${PAPER.id}`);
    const drawer = await screen.findByRole('dialog', { name: 'Sửa món Giấy A4' });
    expect(within(drawer).getByRole('button', { name: 'Món trước' })).toBeDisabled();
    await userEvent.click(within(drawer).getByRole('button', { name: 'Món sau' }));
    expect(location()).toBe(`?item=${PEN.id}`);
    await screen.findByRole('dialog', { name: 'Sửa món Bút bi xanh' });
    await userEvent.click(screen.getByRole('button', { name: 'Món sau' }));
    await screen.findByRole('dialog', { name: 'Sửa món Bút chì 2B' });
    expect(screen.getByRole('button', { name: 'Món sau' })).toBeDisabled();
  });

  it('đang lọc nhóm Bút & viết: món trước của Bút bi xanh không có (Giấy A4 bị ẩn)', async () => {
    await openCatalog({ items: ITEMS }, `/admin/catalog?group=c-pen&item=${PEN.id}`);
    const drawer = await screen.findByRole('dialog', { name: 'Sửa món Bút bi xanh' });
    expect(within(drawer).getByRole('button', { name: 'Món trước' })).toBeDisabled();
  });

  it('"Thêm món vào nhóm" → ?item=new&itemCat=, ngăn kéo "Thêm món" chọn sẵn nhóm; Hủy đóng và xóa tham số', async () => {
    await openCatalog({ items: ITEMS });
    await userEvent.click(screen.getByRole('button', { name: 'Thêm món vào nhóm Bút & viết' }));
    expect(location()).toBe('?item=new&itemCat=c-pen');
    const drawer = await screen.findByRole('dialog', { name: 'Thêm món' });
    expect(within(drawer).getByRole('radio', { name: 'Bút & viết' })).toHaveAttribute('aria-checked', 'true');
    await userEvent.click(within(drawer).getByRole('button', { name: 'Hủy' }));
    expect(location()).toBe('');
  });
});

describe('Danh mục — panel phủ: URL, focus, không đẩy lưới', () => {
  it('F5/dán URL ?item=<id> mở đúng món, bộ đếm "2/3" theo danh sách đang hiện', async () => {
    await openCatalog({ items: ITEMS }, `/admin/catalog?item=${PEN.id}`);
    const panel = await screen.findByRole('dialog', { name: 'Sửa món Bút bi xanh' });
    expect(within(panel).getByText('2/3')).toBeInTheDocument();
  });

  it.each(['00000000-0000-4000-8000-000000000000', 'rac'])('?item=%s không tồn tại → không panel, tham số bị gỡ, không báo lỗi', async (bad) => {
    await openCatalog({ items: ITEMS }, `/admin/catalog?q=b&item=${bad}`);
    await waitFor(() => expect(location()).toBe('?q=b'));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('đóng bằng Esc → focus về nút "Sửa" của thẻ đã mở; lưới không bị đẩy (#main không has-drawer, không padding)', async () => {
    await openCatalog({ items: ITEMS }, '/admin/catalog', true);
    const edit = screen.getByRole('button', { name: 'Sửa Bút bi xanh' });
    const main = screen.getByRole('main');
    const styleBefore = main.getAttribute('style');
    await userEvent.click(edit);
    await screen.findByRole('dialog', { name: 'Sửa món Bút bi xanh' });
    expect(edit.closest('article')).toHaveClass('is-open');
    expect(main).not.toHaveClass('has-drawer');
    expect(main.getAttribute('style')).toBe(styleBefore);
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(location()).toBe('');
    expect(document.activeElement).toBe(edit);
  });

  it('sửa tên rồi ↓ → hỏi; "Ở lại" vẫn món cũ, nháp còn; "Bỏ thay đổi" sang món kề', async () => {
    await openCatalog({ items: ITEMS }, `/admin/catalog?item=${PAPER.id}`);
    const panel = await screen.findByRole('dialog', { name: 'Sửa món Giấy A4' });
    await userEvent.type(within(panel).getByLabelText(/^Tên món/), ' X');
    await userEvent.click(within(panel).getByRole('button', { name: 'Món sau' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Ở lại' }));
    expect(location()).toBe(`?item=${PAPER.id}`);
    expect(within(panel).getByLabelText(/^Tên món/)).toHaveValue('Giấy A4 X');
    await userEvent.click(within(panel).getByRole('button', { name: 'Món sau' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Bỏ thay đổi' }));
    await waitFor(() => expect(location()).toBe(`?item=${PEN.id}`));
  });
});
