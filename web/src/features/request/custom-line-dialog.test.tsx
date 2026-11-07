import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, renderWithI18n, screen, userEvent, within } from '@/test/test-utils';
import { ConfirmProvider } from '@/ui/confirm-provider';
import { MeContext } from '@/lib/me';
import i18n from '@/lib/i18n';
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
      <ConfirmProvider>
        <CustomLineDialog initial={initial} maxQty={20} onSubmit={onSubmit} onClose={onClose} />
      </ConfirmProvider>
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

  it('mở hộp chưa báo lỗi; rời ô Tên khi còn trống → gợi ý "Cần thêm: tên món." và nút Thêm vô hiệu (ĐVT đã chọn sẵn)', async () => {
    setup();
    await screen.findByRole('dialog', { name: 'Thêm món khác' });
    expect(screen.queryByText('Cần thêm: tên món.')).toBeNull();
    await userEvent.click(screen.getByLabelText('Tên món'));
    await userEvent.tab();
    expect(screen.getByText('Cần thêm: tên món.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Thêm vào phiếu' })).toBeDisabled();
  });

  it('đủ tên, ĐVT, số lượng, ghi chú → onSubmit đúng dữ liệu, không tải gì lên', async () => {
    const { fetchMock, onSubmit } = setup();
    await screen.findByRole('dialog', { name: 'Thêm món khác' });
    await userEvent.type(screen.getByLabelText('Tên món'), '  Bìa còng 7cm ');
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

  it('số lượng khóa ở default_max_qty 20: 19 → "Thêm" lên 20 rồi vô hiệu, hiện "Đã tới tối đa 20/tháng"', async () => {
    const { onSubmit } = setup({ custom_name: 'Bìa còng', custom_unit: 'cai', custom_note: null, image_file_id: 'f-9', qty: 19 });
    await screen.findByRole('dialog', { name: 'Sửa món khác' });
    const plus = screen.getByRole('button', { name: 'Thêm Số lượng' });
    expect(plus).toBeEnabled();
    await userEvent.click(plus);
    expect(screen.getByRole('spinbutton', { name: 'Số lượng' })).toHaveValue(20);
    expect(plus).toBeDisabled();
    expect(screen.getByText('Đã tới tối đa 20/tháng')).toBeInTheDocument();
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

  it('mở mới: ĐVT chọn sẵn "cái", đổi được sang "cây"; chỉ cần tên là "Thêm vào phiếu" bấm được', async () => {
    const { onSubmit } = setup();
    expect(await screen.findByLabelText('Đơn vị tính')).toHaveValue('cai');
    expect(screen.getByRole('button', { name: 'Thêm vào phiếu' })).toBeDisabled();
    await userEvent.type(screen.getByLabelText('Tên món'), 'Bìa còng');
    expect(screen.getByRole('button', { name: 'Thêm vào phiếu' })).toBeEnabled();
    await userEvent.selectOptions(screen.getByLabelText('Đơn vị tính'), 'cay');
    await userEvent.click(screen.getByRole('button', { name: 'Thêm vào phiếu' }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ custom_unit: 'cay' }));
  });

  it('ĐVT và Số lượng cùng một hàng (.rq-custom-row có cả hai nhãn)', async () => {
    setup();
    await screen.findByRole('dialog', { name: 'Thêm món khác' });
    const row = document.querySelector<HTMLElement>('.rq-custom-row')!;
    expect(within(row).getByLabelText('Đơn vị tính')).toBeInTheDocument();
    expect(within(row).getByRole('spinbutton', { name: 'Số lượng' })).toBeInTheDocument();
  });

  it('qty 19: không có chữ "tối đa"; bấm + lên 20 → "Đã tới tối đa 20/tháng", + vô hiệu; bấm − về 19 → chữ biến mất', async () => {
    setup({ custom_name: 'Bìa còng', custom_unit: 'cai', custom_note: null, image_file_id: null, qty: 19 });
    await screen.findByRole('dialog', { name: 'Sửa món khác' });
    expect(screen.queryByText(/tối đa/i)).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Thêm Số lượng' }));
    expect(screen.getByText('Đã tới tối đa 20/tháng')).toHaveClass('rq-custom-atmax');
    expect(screen.getByRole('button', { name: 'Thêm Số lượng' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Bớt Số lượng' }));
    expect(screen.queryByText(/tối đa/i)).toBeNull();
  });

  it('bấm nền khi đã gõ tên → hộp vẫn mở, chữ còn nguyên; Esc → hỏi "Bỏ thay đổi?"', async () => {
    const { onClose } = setup();
    await screen.findByRole('dialog', { name: 'Thêm món khác' });
    await userEvent.type(screen.getByLabelText('Tên món'), 'Bìa còng');
    await userEvent.pointer({ keys: '[MouseLeft]', target: document.querySelector('.modal-backdrop')! });
    expect(screen.getByRole('dialog', { name: 'Thêm món khác' })).toBeInTheDocument();
    expect(screen.getByLabelText('Tên món')).toHaveValue('Bìa còng');
    expect(onClose).not.toHaveBeenCalled();
    await userEvent.keyboard('{Escape}');
    expect(await screen.findByText('Bỏ thay đổi?')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('mở mới chưa gõ gì: Esc đóng ngay (ĐVT chọn sẵn không tính là đã sửa)', async () => {
    const { onClose } = setup();
    await screen.findByRole('dialog', { name: 'Thêm món khác' });
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });

  it('ô Tên, ĐVT, Ghi chú dùng class rq-custom-input (chữ ≥ 16px để iOS không phóng to)', async () => {
    setup();
    await screen.findByRole('dialog', { name: 'Thêm món khác' });
    for (const label of ['Tên món', 'Đơn vị tính', 'Ghi chú (tùy chọn)']) expect(screen.getByLabelText(label)).toHaveClass('rq-custom-input');
    const css = readFileSync(resolve(process.cwd(), 'src/features/request/request.m1.css'), 'utf8');
    expect(css).toMatch(/\.rq-custom-input \{[^}]*font-size: 16px/);
  });

  it('câu mới không chứa " — "', () => {
    for (const lng of ['vi', 'en']) for (const k of ['request.custom.intro', 'request.custom.atMax']) expect(i18n.t(k, { lng, max: 20 })).not.toContain(' — ');
  });
});
