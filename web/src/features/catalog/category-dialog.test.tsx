import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, renderWithI18n, screen, userEvent, within } from '@/test/test-utils';
import { makeMe } from '@/test/fixtures-me';
import { MeContext } from '@/lib/me';
import { ConfirmProvider } from '@/ui/confirm-provider';
import { ToastProvider } from '@/ui/toast-provider';
import type { Category } from './catalog.api';
import { CategoryDialog } from './category-dialog';

const cat = (id: string, sort_order: number, active = true): Category => ({ id, name: `Nhóm ${id}`, name_en: null, sort_order, active });

function render(categories: Category[], reply: Response = jsonResponse(201, cat('new', 0)), category?: Category) {
  const f = vi.fn(async () => reply);
  vi.stubGlobal('fetch', f);
  const onClose = vi.fn();
  renderWithI18n(
    <MeContext.Provider value={makeMe('admin')}>
      <ToastProvider>
        <ConfirmProvider>
          <CategoryDialog categories={categories} category={category} onClose={onClose} />
        </ConfirmProvider>
      </ToastProvider>
    </MeContext.Provider>,
  );
  return { f, onClose, dialog: within(screen.getByRole('dialog', { name: category ? 'Sửa nhóm' : 'Thêm nhóm' })) };
}

afterEach(() => vi.unstubAllGlobals());

describe('Hộp thoại Thêm nhóm', () => {
  it('2 nhóm (1 đã ngừng) → "Nhóm mới đứng thứ 3 và nhận màu cát mật."', () => {
    const { dialog } = render([cat('a', 10), cat('b', 20, false)]);
    expect(dialog.getByText('Nhóm mới đứng thứ 3 và nhận màu cát mật.')).toBeInTheDocument();
  });

  it.each([
    [6, 7, 'ô liu'],
    [7, 8, 'xanh đá'],
  ])('%d nhóm → đứng thứ %d, màu %s (từ nhóm thứ 8 lặp lại)', (n, k, tone) => {
    const { dialog } = render(Array.from({ length: n }, (_, i) => cat(`c${i}`, (i + 1) * 10)));
    expect(dialog.getByText(`Nhóm mới đứng thứ ${k} và nhận màu ${tone}.`)).toBeInTheDocument();
  });

  it('POST {name, name_en, sort_order: max+10} rồi đóng, toast "Đã thêm nhóm {tên}"', async () => {
    const { f, onClose, dialog } = render([cat('a', 10), cat('b', 35, false)]);
    expect(dialog.getByLabelText(/^Tên nhóm/)).toHaveAttribute('maxLength', '120');
    await userEvent.type(dialog.getByLabelText(/^Tên nhóm/), ' Mực in ');
    await userEvent.type(dialog.getByLabelText('Tên tiếng Anh'), 'Ink');
    await userEvent.click(dialog.getByRole('button', { name: 'Thêm nhóm' }));
    await vi.waitFor(() => expect(onClose).toHaveBeenCalled());
    const call = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(call[0]).toBe('/api/admin/item-categories');
    expect(JSON.parse(String(call[1].body))).toEqual({ name: 'Mực in', name_en: 'Ink', sort_order: 45 });
    expect(await screen.findByText('Đã thêm nhóm Mực in')).toBeInTheDocument();
  });

  it('chưa có nhóm nào → sort_order 10', async () => {
    const { f, dialog } = render([]);
    await userEvent.type(dialog.getByLabelText(/^Tên nhóm/), 'Đầu tiên');
    await userEvent.click(dialog.getByRole('button', { name: 'Thêm nhóm' }));
    await vi.waitFor(() => expect(f).toHaveBeenCalled());
    expect(JSON.parse(String((f.mock.calls[0] as unknown as [string, RequestInit])[1].body))).toMatchObject({ sort_order: 10 });
  });

  it('CATEGORY_EXISTS (trùng khác hoa thường) → "Đã có nhóm tên này." tại ô Tên nhóm', async () => {
    const { dialog } = render([cat('a', 10)], jsonResponse(409, { code: 'CATEGORY_EXISTS', message: 'x' }));
    await userEvent.type(dialog.getByLabelText(/^Tên nhóm/), 'nhóm A');
    await userEvent.click(dialog.getByRole('button', { name: 'Thêm nhóm' }));
    const input = dialog.getByLabelText(/^Tên nhóm/);
    await vi.waitFor(() => expect(input).toHaveAccessibleDescription('Đã có nhóm tên này.'));
    expect(input).toHaveAttribute('aria-invalid', 'true');
  });

  it('VALIDATION [name] → lỗi ô Tên nhóm', async () => {
    const { dialog } = render([], jsonResponse(400, { code: 'VALIDATION', message: 'x', fields: ['name'] }));
    await userEvent.type(dialog.getByLabelText(/^Tên nhóm/), 'x');
    await userEvent.click(dialog.getByRole('button', { name: 'Thêm nhóm' }));
    await vi.waitFor(() => expect(dialog.getByLabelText(/^Tên nhóm/)).toHaveAccessibleDescription('Kiểm tra lại giá trị này.'));
  });

  describe('chế độ Sửa', () => {
    const editing = { ...cat('b', 20), name: 'Bút & viết', name_en: 'Pens' };

    it('điền sẵn tên và tên tiếng Anh, không có dòng vị trí/màu nhóm mới', () => {
      const { dialog } = render([cat('a', 10), editing], undefined, editing);
      expect(dialog.getByLabelText(/^Tên nhóm/)).toHaveValue('Bút & viết');
      expect(dialog.getByLabelText('Tên tiếng Anh')).toHaveValue('Pens');
      expect(dialog.queryByText(/Nhóm mới đứng thứ/)).toBeNull();
    });

    it('chỉ PATCH trường đã đổi: xóa trắng tên tiếng Anh → {name_en: null}, toast "Đã lưu nhóm Bút & viết"', async () => {
      const { f, onClose, dialog } = render([editing], jsonResponse(200, { ...editing, name_en: null }), editing);
      await userEvent.clear(dialog.getByLabelText('Tên tiếng Anh'));
      await userEvent.click(dialog.getByRole('button', { name: 'Lưu thay đổi' }));
      await vi.waitFor(() => expect(onClose).toHaveBeenCalled());
      const call = f.mock.calls[0] as unknown as [string, RequestInit];
      expect([call[0], call[1].method, JSON.parse(String(call[1].body))]).toEqual(['/api/admin/item-categories/b', 'PATCH', { name_en: null }]);
      expect(await screen.findByText('Đã lưu nhóm Bút & viết')).toBeInTheDocument();
    });

    it('CATEGORY_EXISTS khi đổi tên → lỗi gắn ô Tên nhóm', async () => {
      const { dialog } = render([editing], jsonResponse(409, { code: 'CATEGORY_EXISTS', message: 'x' }), editing);
      await userEvent.clear(dialog.getByLabelText(/^Tên nhóm/));
      await userEvent.type(dialog.getByLabelText(/^Tên nhóm/), 'giấy & sổ');
      await userEvent.click(dialog.getByRole('button', { name: 'Lưu thay đổi' }));
      await vi.waitFor(() => expect(dialog.getByLabelText(/^Tên nhóm/)).toHaveAccessibleDescription('Đã có nhóm tên này.'));
    });
  });
});
