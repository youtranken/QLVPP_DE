import { beforeEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, renderWithI18n, screen, userEvent } from '@/test/test-utils';
import { makeMe } from '@/test/fixtures-me';
import { MeContext } from '@/lib/me';
import { compressImage } from '@/lib/image-compress';
import { ConfirmProvider } from '@/ui/confirm-provider';
import { ItemForm } from '@/features/catalog/item-form';
import type { AdminItem, Category } from '@/features/catalog/catalog.api';

vi.mock('@/lib/image-compress', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/image-compress')>();
  return { ...actual, compressImage: vi.fn(actual.compressImage) };
});

const CATEGORIES: Category[] = [
  { id: 'c-1', name: 'Bút & viết', name_en: 'Pens', sort_order: 0, active: true },
];

const ITEM: AdminItem = {
  id: 'i-1',
  code: null,
  name: 'Bút bi xanh',
  name_en: null,
  unit: 'cay',
  pack_note: 'hộp 20 cây',
  category_id: 'c-1',
  image_file_id: 'f-old',
  admin_only: false,
  max_qty: 20,
  stock_qty: 5,
  min_stock: 0,
  active: true,
  sort_order: 0,
  missing_image: false,
};

const png = () => new File([new Uint8Array([137, 80, 78, 71])], 'but.png', { type: 'image/png' });

function renderForm(item: AdminItem | null = null, onClose = vi.fn()) {
  renderWithI18n(
    <MeContext.Provider value={makeMe('admin')}>
      <ConfirmProvider>
        <ItemForm item={item} categories={CATEGORIES} onClose={onClose} />
      </ConfirmProvider>
    </MeContext.Provider>,
  );
  return onClose;
}

function stubApi(itemResponse: Response) {
  const fetchMock = vi.fn((url: string, _init?: RequestInit) =>
    Promise.resolve(
      url === '/api/files' ? jsonResponse(201, { id: 'f-new', mime: 'image/png', size_bytes: 4 }) : itemResponse,
    ),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function callTo(fetchMock: ReturnType<typeof stubApi>, url: string) {
  const call = fetchMock.mock.calls.find((c) => c[0] === url) as [string, RequestInit] | undefined;
  if (!call) throw new Error(`không có request tới ${url}`);
  return { init: call[1], body: JSON.parse(String(call[1].body)) as Record<string, unknown> };
}

beforeEach(() => {
  vi.mocked(compressImage).mockImplementation(async (file) => ({
    blob: file,
    mime: 'image/png',
    width: 10,
    height: 10,
  }));
});

describe('ItemForm', () => {
  it('chưa có ảnh → nút "Thêm món" bị vô hiệu và hiện "Cần có ảnh"', async () => {
    renderForm();
    await userEvent.type(screen.getByLabelText('Tên món'), 'Bút chì');
    expect(screen.getByRole('button', { name: 'Thêm món' })).toBeDisabled();
    expect(screen.getByText('Cần có ảnh')).toBeInTheDocument();
  });

  it('chọn ảnh HEIC → "Chọn ảnh JPG, PNG hoặc WebP", không tải lên', async () => {
    const actual = await vi.importActual<typeof import('@/lib/image-compress')>('@/lib/image-compress');
    vi.mocked(compressImage).mockImplementation(actual.compressImage);
    const fetchMock = stubApi(jsonResponse(201, {}));
    renderForm();
    const heic = new File([new Uint8Array([0])], 'IMG_0001.HEIC', { type: 'image/heic' });
    await userEvent.upload(screen.getByLabelText('Chọn hoặc chụp ảnh'), heic);
    expect(await screen.findByText('Chọn ảnh JPG, PNG hoặc WebP')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Thêm món' })).toBeDisabled();
  });

  it('chọn ảnh → tải lên purpose=item_image, hiện ảnh xem trước, nút Thêm món bật', async () => {
    const fetchMock = stubApi(jsonResponse(201, {}));
    renderForm();
    await userEvent.upload(screen.getByLabelText('Chọn hoặc chụp ảnh'), png());
    expect(await screen.findByRole('img', { name: 'Ảnh món' })).toHaveAttribute('src', '/api/files/f-new');
    const { init } = { init: (fetchMock.mock.calls[0] as [string, RequestInit])[1] };
    expect((init.body as FormData).get('purpose')).toBe('item_image');
    expect((init.headers as Record<string, string>)['X-CSRF-Token']).toBe('csrf-1');
    expect(screen.queryByText('Cần có ảnh')).toBeNull();
    await userEvent.type(screen.getByLabelText('Tên món'), 'Bút chì');
    expect(screen.getByRole('button', { name: 'Thêm món' })).toBeEnabled();
  });

  it('server trả UNIT_REQUIRED → thông báo gắn vào ô Đơn vị tính', async () => {
    stubApi(jsonResponse(400, { code: 'UNIT_REQUIRED', message: 'Chọn đơn vị tính.' }));
    renderForm();
    await userEvent.type(screen.getByLabelText('Tên món'), 'Bút chì');
    await userEvent.upload(screen.getByLabelText('Chọn hoặc chụp ảnh'), png());
    await screen.findByRole('img', { name: 'Ảnh món' });
    await userEvent.click(screen.getByRole('button', { name: 'Thêm món' }));
    const unit = screen.getByLabelText('Đơn vị tính');
    await vi.waitFor(() => expect(unit).toHaveAccessibleDescription('Chọn đơn vị tính.'));
    expect(unit).toHaveAttribute('aria-invalid', 'true');
  });

  it('tạo món: POST /api/admin/items kèm CSRF, image_file_id, max_qty mặc định 20, rồi đóng', async () => {
    const fetchMock = stubApi(jsonResponse(201, { ...ITEM, id: 'i-new' }));
    const onClose = renderForm();
    await userEvent.type(screen.getByLabelText('Tên món'), 'Bút chì');
    await userEvent.selectOptions(screen.getByLabelText('Đơn vị tính'), 'cây');
    await userEvent.type(screen.getByLabelText('Quy cách'), 'hộp 12 cây');
    await userEvent.selectOptions(screen.getByLabelText('Nhóm'), 'c-1');
    await userEvent.click(screen.getByLabelText('Chỉ Hành chính được đặt'));
    await userEvent.upload(screen.getByLabelText('Chọn hoặc chụp ảnh'), png());
    await screen.findByRole('img', { name: 'Ảnh món' });
    expect(screen.getByLabelText('Tối đa mỗi tháng')).toHaveValue(20);
    await userEvent.click(screen.getByRole('button', { name: 'Thêm món' }));
    await vi.waitFor(() => expect(onClose).toHaveBeenCalled());
    const { init, body } = callTo(fetchMock, '/api/admin/items');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>)['X-CSRF-Token']).toBe('csrf-1');
    expect(body).toMatchObject({
      name: 'Bút chì',
      unit: 'cay',
      pack_note: 'hộp 12 cây',
      category_id: 'c-1',
      image_file_id: 'f-new',
      admin_only: true,
      max_qty: 20,
    });
  });

  it('sửa món: hiện ảnh hiện có, PATCH chỉ gửi trường đã đổi', async () => {
    const fetchMock = stubApi(jsonResponse(200, ITEM));
    renderForm(ITEM);
    expect(screen.getByRole('img', { name: 'Ảnh món' })).toHaveAttribute('src', '/api/files/f-old');
    const max = screen.getByLabelText('Tối đa mỗi tháng');
    await userEvent.clear(max);
    await userEvent.type(max, '30');
    await userEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const { init, body } = callTo(fetchMock, '/api/admin/items/i-1');
    expect(init.method).toBe('PATCH');
    expect(body).toEqual({ max_qty: 30 });
  });

  it('server trả VALIDATION fields [max_qty] → lỗi gắn vào ô Tối đa mỗi tháng', async () => {
    stubApi(jsonResponse(400, { code: 'VALIDATION', message: 'x', fields: ['max_qty'] }));
    renderForm(ITEM);
    await userEvent.clear(screen.getByLabelText('Tối đa mỗi tháng'));
    await userEvent.type(screen.getByLabelText('Tối đa mỗi tháng'), '0');
    await userEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));
    await vi.waitFor(() =>
      expect(screen.getByLabelText('Tối đa mỗi tháng')).toHaveAccessibleDescription('Kiểm tra lại giá trị này.'),
    );
  });
});
