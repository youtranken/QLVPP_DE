import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, renderWithI18n, screen, userEvent, waitFor, within } from '@/test/test-utils';
import { makeMe } from '@/test/fixtures-me';
import { MeContext } from '@/lib/me';
import { ConfirmProvider } from '@/ui/confirm-provider';
import type { AdminItem, Category } from '@/features/catalog/catalog.api';
import { ReviewActions, type ReviewableLine } from './review-actions';
import { reviewResult } from './review-fixtures';

const LINE: ReviewableLine = {
  id: 'l-1',
  custom_name: 'Băng keo 2 mặt',
  custom_unit: 'cai',
  image_file_id: 'f-line',
  qty: 2,
  review_status: 'pending',
  review_note: null,
};
const CATEGORIES: Category[] = [
  { id: 'c-1', name: 'Văn phòng', name_en: null, sort_order: 0, active: true },
  { id: 'c-off', name: 'Đã bỏ', name_en: null, sort_order: 1, active: false },
];
const adminItem = (over: Partial<AdminItem>): AdminItem => ({
  id: 'i-x',
  code: null,
  name: 'Món',
  name_en: null,
  unit: 'cai',
  pack_note: null,
  category_id: 'c-1',
  image_file_id: 'f-x',
  admin_only: false,
  max_qty: 20,
  stock_qty: 0,
  restock_level: null,
  stock_state: 'untracked',
  active: true,
  sort_order: 0,
  missing_image: false,
  ...over,
});
const ITEMS = [
  adminItem({ id: 'i-2', name: 'Băng keo trong', unit: 'cuon' }),
  adminItem({ id: 'i-3', name: 'Bút bi', unit: 'cay' }),
  adminItem({ id: 'i-old', name: 'Băng keo cũ', active: false }),
];

function stub(review: () => Response = () => jsonResponse(200, reviewResult('converted', { item_id: 'i-new' }))) {
  const fetchMock = vi.fn((url: string) => {
    if (url === '/api/admin/lines/l-1/review') return Promise.resolve(review());
    if (url === '/api/admin/items') return Promise.resolve(jsonResponse(200, ITEMS));
    if (url.startsWith('/api/item-categories')) return Promise.resolve(jsonResponse(200, CATEGORIES));
    return Promise.resolve(jsonResponse(404, {}));
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const sentBody = (f: ReturnType<typeof stub>) => {
  const call = f.mock.calls.find((c) => c[0] === '/api/admin/lines/l-1/review') as unknown as [string, RequestInit];
  return JSON.parse(String(call[1].body));
};

async function openConvert() {
  const onDone = vi.fn();
  renderWithI18n(
    <MeContext.Provider value={makeMe('admin')}>
      <ConfirmProvider>
        <ReviewActions line={LINE} onDone={onDone} />
      </ConfirmProvider>
    </MeContext.Provider>,
  );
  await userEvent.click(screen.getByRole('button', { name: 'Thêm vào danh mục…' }));
  const dialog = screen.getByRole('dialog', { name: 'Thêm “Băng keo 2 mặt” vào danh mục' });
  await within(dialog).findByRole('option', { name: 'Văn phòng' });
  return { dialog, onDone };
}

afterEach(() => vi.unstubAllGlobals());

describe('ConvertDialog — Thêm vào danh mục', () => {
  it('món mới điền sẵn tên/ĐVT/ảnh của dòng; không đổi ảnh → body không gửi image_file_id (server dùng ảnh dòng)', async () => {
    const fetchMock = stub();
    const { dialog, onDone } = await openConvert();
    expect(within(dialog).getByRole('radio', { name: 'Món mới' })).toBeChecked();
    expect(within(dialog).getByLabelText('Tên món')).toHaveValue('Băng keo 2 mặt');
    expect(within(dialog).getByLabelText('Đơn vị tính')).toHaveValue('cai');
    expect(within(dialog).getByRole('img', { name: 'Ảnh món' })).toHaveAttribute('src', '/api/files/f-line');
    expect(within(dialog).queryByLabelText('Thứ tự hiển thị')).toBeNull();
    expect(within(dialog).queryByRole('option', { name: /Đã bỏ/ })).toBeNull();
    await userEvent.selectOptions(within(dialog).getByLabelText('Nhóm'), 'c-1');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Thêm vào danh mục' }));
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(sentBody(fetchMock)).toEqual({
      action: 'convert',
      item: { name: 'Băng keo 2 mặt', name_en: null, unit: 'cai', pack_note: null, category_id: 'c-1', max_qty: 20, admin_only: false },
    });
    expect(screen.getByText('Đã thêm vào danh mục')).toBeInTheDocument();
  });

  it('món mới chưa chọn nhóm → báo tại ô Nhóm, không gửi', async () => {
    const fetchMock = stub();
    const { dialog } = await openConvert();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Thêm vào danh mục' }));
    expect(within(dialog).getByLabelText('Nhóm')).toHaveAttribute('aria-invalid', 'true');
    expect(within(dialog).getByText('Chọn nhóm cho món mới.')).toBeInTheDocument();
    expect(fetchMock.mock.calls.some((c) => c[0] === '/api/admin/lines/l-1/review')).toBe(false);
  });

  it('đổi ĐVT khác dòng gốc → cảnh báo vàng; đổi lại → mất cảnh báo', async () => {
    stub();
    const { dialog } = await openConvert();
    expect(within(dialog).queryByText(/ĐVT khác dòng gốc/)).toBeNull();
    await userEvent.selectOptions(within(dialog).getByLabelText('Đơn vị tính'), 'hop');
    expect(within(dialog).getByText('ĐVT khác dòng gốc (cái) — số lượng 2 sẽ tính theo ĐVT mới.')).toBeInTheDocument();
    await userEvent.selectOptions(within(dialog).getByLabelText('Đơn vị tính'), 'cai');
    expect(within(dialog).queryByText(/ĐVT khác dòng gốc/)).toBeNull();
  });

  it('món có sẵn: chỉ món đang dùng; ĐVT khác → cảnh báo; gửi {existing_id}', async () => {
    const fetchMock = stub();
    const { dialog, onDone } = await openConvert();
    await userEvent.click(within(dialog).getByRole('radio', { name: 'Món có sẵn' }));
    const pick = within(dialog).getByLabelText('Món trong danh mục');
    expect(within(pick).queryByRole('option', { name: /Băng keo cũ/ })).toBeNull();
    expect(within(dialog).getByRole('button', { name: 'Thêm vào danh mục' })).toBeDisabled();
    await userEvent.selectOptions(pick, 'i-2');
    expect(within(dialog).getByText('ĐVT khác dòng gốc (cái) — số lượng 2 sẽ tính theo ĐVT mới.')).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Thêm vào danh mục' }));
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(sentBody(fetchMock)).toEqual({ action: 'convert', item: { existing_id: 'i-2' } });
  });

  it('ITEM_INACTIVE → lỗi tại ô chọn món, hộp vẫn mở', async () => {
    stub(() => jsonResponse(400, { code: 'ITEM_INACTIVE' }));
    const { dialog } = await openConvert();
    await userEvent.click(within(dialog).getByRole('radio', { name: 'Món có sẵn' }));
    await userEvent.selectOptions(within(dialog).getByLabelText('Món trong danh mục'), 'i-3');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Thêm vào danh mục' }));
    expect(await within(dialog).findByText('Món này đã ngừng — chọn món khác.')).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
