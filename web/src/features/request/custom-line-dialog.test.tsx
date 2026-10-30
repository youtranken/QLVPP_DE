import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, renderWithI18n, screen, userEvent } from '@/test/test-utils';
import { MeContext } from '@/lib/me';
import { makeMe } from '@/test/fixtures-me';
import { CustomLineDialog } from './custom-line-dialog';
import type { CustomLineInput } from './use-cart';

function setup(initial?: CustomLineInput) {
  const fetchMock = vi.fn(() => Promise.resolve(jsonResponse(500, {})));
  vi.stubGlobal('fetch', fetchMock);
  const onSubmit = vi.fn();
  const onClose = vi.fn();
  renderWithI18n(
    <MeContext.Provider value={makeMe('member')}>
      <CustomLineDialog initial={initial} maxQty={20} onSubmit={onSubmit} onClose={onClose} />
    </MeContext.Provider>,
  );
  return { fetchMock, onSubmit, onClose };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('CustomLineDialog', () => {
  it('không có ô ảnh; chỉ cần tên + ĐVT là gửi được, image_file_id null, không gọi mạng; tên tối đa 120 ký tự', async () => {
    const { onSubmit, fetchMock } = setup();
    const dialog = await screen.findByRole('dialog', { name: 'Thêm món khác' });
    expect(screen.queryByLabelText(/ảnh/i)).toBeNull();
    expect(screen.queryByText(/ảnh/i)).toBeNull();
    expect(screen.getByRole('button', { name: 'Thêm vào phiếu' })).toBeDisabled();
    await userEvent.type(screen.getByLabelText('Tên món'), 'Bìa còng 7cm');
    await userEvent.selectOptions(screen.getByLabelText('Đơn vị tính'), 'cai');
    expect(screen.queryByText(/Cần thêm/)).not.toBeInTheDocument();
    expect(screen.getByLabelText('Tên món')).toHaveAttribute('maxlength', '120');
    expect(dialog).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Thêm vào phiếu' }));
    expect(onSubmit).toHaveBeenCalledWith({
      custom_name: 'Bìa còng 7cm',
      custom_unit: 'cai',
      custom_note: null,
      image_file_id: null,
      qty: 1,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('thiếu tên và ĐVT → gợi ý "Cần thêm: tên món, đơn vị tính." và nút Thêm vô hiệu', async () => {
    setup();
    await screen.findByRole('dialog', { name: 'Thêm món khác' });
    expect(screen.getByText('Cần thêm: tên món, đơn vị tính.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Thêm vào phiếu' })).toBeDisabled();
  });

  it('đủ tên, ĐVT, số lượng, ghi chú → onSubmit đúng dữ liệu, không tải gì lên', async () => {
    const { fetchMock, onSubmit } = setup();
    await screen.findByRole('dialog', { name: 'Thêm món khác' });
    await userEvent.type(screen.getByLabelText('Tên món'), '  Bìa còng 7cm ');
    await userEvent.selectOptions(screen.getByLabelText('Đơn vị tính'), 'cai');
    await userEvent.click(screen.getByRole('button', { name: 'Thêm Số lượng' }));
    await userEvent.type(screen.getByLabelText('Ghi chú (tùy chọn)'), 'màu xanh');
    await userEvent.click(screen.getByRole('button', { name: 'Thêm vào phiếu' }));
    expect(onSubmit).toHaveBeenCalledWith({
      custom_name: 'Bìa còng 7cm',
      custom_unit: 'cai',
      custom_note: 'màu xanh',
      image_file_id: null,
      qty: 2,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('số lượng khóa ở default_max_qty 20: 19 → "Thêm" lên 20 rồi vô hiệu, có gợi ý tối đa 20', async () => {
    const { onSubmit } = setup({ custom_name: 'Bìa còng', custom_unit: 'cai', custom_note: null, image_file_id: 'f-9', qty: 19 });
    await screen.findByRole('dialog', { name: 'Sửa món khác' });
    const plus = screen.getByRole('button', { name: 'Thêm Số lượng' });
    expect(plus).toBeEnabled();
    await userEvent.click(plus);
    expect(screen.getByRole('spinbutton', { name: 'Số lượng' })).toHaveValue(20);
    expect(plus).toBeDisabled();
    expect(screen.getByText(/tối đa 20/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ qty: 20 }));
  });

  it('sửa dòng có sẵn: điền sẵn, không có ô ảnh, nút "Lưu thay đổi", ghi chú rỗng → null, ảnh cũ giữ nguyên', async () => {
    const { onSubmit } = setup({ custom_name: 'Bìa còng', custom_unit: 'cai', custom_note: null, image_file_id: 'f-9', qty: 3 });
    await screen.findByRole('dialog', { name: 'Sửa món khác' });
    expect(screen.getByLabelText('Tên món')).toHaveValue('Bìa còng');
    expect(screen.queryByLabelText(/ảnh/i)).toBeNull();
    expect(screen.getByRole('spinbutton', { name: 'Số lượng' })).toHaveValue(3);
    await userEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));
    expect(onSubmit).toHaveBeenCalledWith({ custom_name: 'Bìa còng', custom_unit: 'cai', custom_note: null, image_file_id: 'f-9', qty: 3 });
  });
});
