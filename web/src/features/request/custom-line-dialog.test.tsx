import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, renderWithI18n, screen, userEvent, waitFor } from '@/test/test-utils';
import { MeContext } from '@/lib/me';
import { makeMe } from '@/test/fixtures-me';
import { CustomLineDialog } from './custom-line-dialog';
import type { CustomLineInput } from './use-cart';

// jsdom không giải mã được ảnh: giả nén — HEIC trả UNSUPPORTED như bản thật
vi.mock('@/lib/image-compress', () => ({
  compressImage: vi.fn(async (file: File) =>
    /\.hei[cf]$/i.test(file.name) ? { error: 'UNSUPPORTED' } : { blob: file, mime: 'image/png', width: 10, height: 10 },
  ),
}));

function setup(initial?: CustomLineInput) {
  const fetchMock = vi.fn((url: string, init?: RequestInit) =>
    Promise.resolve(url === '/api/files' && init?.method === 'POST' ? jsonResponse(201, { id: 'f-1' }) : jsonResponse(500, {})),
  );
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

const png = () => new File(['x'], 'bia.png', { type: 'image/png' });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('CustomLineDialog', () => {
  it('chưa có ảnh → nút "Thêm vào phiếu" vô hiệu và ghi "Cần có ảnh"; tên tối đa 120 ký tự', async () => {
    setup();
    const dialog = await screen.findByRole('dialog', { name: 'Thêm món khác' });
    await userEvent.type(screen.getByLabelText('Tên món'), 'Bìa còng 7cm');
    await userEvent.selectOptions(screen.getByLabelText('Đơn vị tính'), 'cai');
    expect(screen.getByText('Cần có ảnh')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Thêm vào phiếu' })).toBeDisabled();
    expect(screen.getByLabelText('Tên món')).toHaveAttribute('maxlength', '120');
    expect(dialog).toBeInTheDocument();
  });

  it('ảnh HEIC → "Chọn ảnh JPG, PNG hoặc WebP", không tải lên', async () => {
    const { fetchMock } = setup();
    await screen.findByRole('dialog', { name: 'Thêm món khác' });
    await userEvent.upload(screen.getByLabelText('Chụp hoặc chọn ảnh'), new File(['x'], 'IMG_1.HEIC', { type: 'image/heic' }));
    expect(await screen.findByText('Chọn ảnh JPG, PNG hoặc WebP')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Thêm vào phiếu' })).toBeDisabled();
  });

  it('đủ tên, ĐVT, số lượng, ghi chú, ảnh (tải với purpose line_image) → onSubmit đúng dữ liệu', async () => {
    const { fetchMock, onSubmit } = setup();
    await screen.findByRole('dialog', { name: 'Thêm món khác' });
    await userEvent.type(screen.getByLabelText('Tên món'), '  Bìa còng 7cm ');
    await userEvent.selectOptions(screen.getByLabelText('Đơn vị tính'), 'cai');
    await userEvent.click(screen.getByRole('button', { name: 'Thêm Số lượng' }));
    await userEvent.type(screen.getByLabelText('Ghi chú (tùy chọn)'), 'màu xanh');
    await userEvent.upload(screen.getByLabelText('Chụp hoặc chọn ảnh'), png());
    await waitFor(() => expect(screen.getByRole('img', { name: 'Ảnh món' })).toHaveAttribute('src', '/api/files/f-1'));
    const body = fetchMock.mock.calls[0][1]?.body as FormData;
    expect(body.get('purpose')).toBe('line_image');

    await userEvent.click(screen.getByRole('button', { name: 'Thêm vào phiếu' }));
    expect(onSubmit).toHaveBeenCalledWith({
      custom_name: 'Bìa còng 7cm',
      custom_unit: 'cai',
      custom_note: 'màu xanh',
      image_file_id: 'f-1',
      qty: 2,
    });
  });

  it('sửa dòng có sẵn: điền sẵn, nút "Lưu thay đổi", ghi chú rỗng → null', async () => {
    const { onSubmit } = setup({ custom_name: 'Bìa còng', custom_unit: 'cai', custom_note: null, image_file_id: 'f-9', qty: 3 });
    await screen.findByRole('dialog', { name: 'Sửa món khác' });
    expect(screen.getByLabelText('Tên món')).toHaveValue('Bìa còng');
    expect(screen.getByRole('spinbutton', { name: 'Số lượng' })).toHaveValue(3);
    await userEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));
    expect(onSubmit).toHaveBeenCalledWith({ custom_name: 'Bìa còng', custom_unit: 'cai', custom_note: null, image_file_id: 'f-9', qty: 3 });
  });
});
