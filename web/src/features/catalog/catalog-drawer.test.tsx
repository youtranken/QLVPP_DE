import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, userEvent, within } from '@/test/test-utils';
import { PAPER, PEN, PENCIL } from './catalog-fixtures';
import { locationSearch, openCatalog, rowOf } from './catalog-fixtures-api';

const ITEMS = [PAPER, PEN, PENCIL];
const location = locationSearch;

afterEach(() => vi.unstubAllGlobals());

describe('Danh mục — ngăn kéo món', () => {
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
    await openCatalog({ items: ITEMS }, `/admin/catalog?cat=c-pen&item=${PEN.id}`);
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
