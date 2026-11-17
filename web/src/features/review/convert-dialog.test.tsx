import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, renderWithI18n, screen, userEvent, waitFor, within, pickOption } from '@/test/test-utils';
import { makeMe } from '@/test/fixtures-me';
import { MeContext } from '@/lib/me';
import { ConfirmProvider } from '@/ui/confirm-provider';
import { ToastProvider } from '@/ui/toast-provider';
import type { AdminItem, Category } from '@/features/catalog/catalog.api';
import { lineView } from '@/test/fixtures-request';
import { ReviewBlock } from '@/features/summary/review-block';
import type { ReviewableLine } from './review.api';
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
  max_qty: 20,
  stock_qty: 0,
  restock_level: null,
  stock_state: 'out',
  active: true,
  usable: over.active ?? true,
  inactive_reason: over.active === false ? 'item' : null,
  sort_order: 0,
  missing_image: false,
  ...over,
});
const ITEMS = [
  adminItem({ id: 'i-2', name: 'Băng keo trong', unit: 'cuon' }),
  adminItem({ id: 'i-3', name: 'Bút bi', unit: 'cay' }),
  adminItem({ id: 'i-old', name: 'Băng keo cũ', active: false }),
  adminItem({ id: 'i-paused', name: 'Băng keo nhóm ngừng', usable: false }),
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

async function openConvert(line: ReviewableLine = LINE) {
  const onDone = vi.fn();
  renderWithI18n(
    <MeContext.Provider value={makeMe('admin')}>
      <ConfirmProvider>
        <ToastProvider>
        <ReviewBlock line={lineView({ ...line })} requestUpdatedAt="2026-11-05T03:00:00.000Z" onDone={onDone} />
        </ToastProvider>
      </ConfirmProvider>
    </MeContext.Provider>,
  );
  await userEvent.click(screen.getByRole('checkbox', { name: 'Thêm luôn vào danh mục' }));
  await userEvent.click(screen.getByRole('button', { name: `Chấp nhận ${line.custom_name}` }));
  const dialog = screen.getByRole('dialog', { name: 'Sản phẩm mới' });
  // Hộp đã tải xong khi ô Nhóm có lựa chọn
  await within(dialog).findAllByText(/Văn phòng/);
  return { dialog, onDone };
}

afterEach(() => vi.unstubAllGlobals());

describe('ConvertDialog — Thêm vào danh mục', () => {
  it('món mới điền sẵn tên/ĐVT/ảnh của dòng; không đổi ảnh → body không gửi image_file_id (server dùng ảnh dòng)', async () => {
    const fetchMock = stub();
    const { dialog, onDone } = await openConvert();
    // Không còn chọn "Món mới / Món có sẵn" và chữ "Gắn dòng vào"
    expect(within(dialog).queryByRole('radio', { name: 'Món mới' })).toBeNull();
    expect(within(dialog).queryByRole('radio', { name: 'Món có sẵn' })).toBeNull();
    expect(within(dialog).queryByText('Gắn dòng vào')).toBeNull();
    expect(within(dialog).getByLabelText(/^Tên món/)).toHaveValue('Băng keo 2 mặt');
    expect(within(dialog).getByLabelText(/^Đơn vị tính/)).toHaveTextContent('cái');
    expect(within(dialog).getByRole('img', { name: 'Ảnh món' })).toHaveAttribute('src', '/api/files/f-line');
    expect(within(dialog).queryByLabelText('Thứ tự hiển thị')).toBeNull();
    expect(within(dialog).queryByRole('radio', { name: /Đã bỏ/ })).toBeNull();
    await userEvent.click(within(dialog).getByRole('radio', { name: 'Văn phòng' }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Mua và thêm vào danh mục' }));
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(sentBody(fetchMock)).toEqual({
      action: 'convert',
      item: { name: 'Băng keo 2 mặt', name_en: null, unit: 'cai', pack_note: null, category_id: 'c-1', max_qty: 20 },
      expected_updated_at: '2026-11-05T03:00:00.000Z',
    });
  });

  it('món mới chưa chọn nhóm → báo tại ô Nhóm, không gửi', async () => {
    const fetchMock = stub();
    const { dialog } = await openConvert();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Mua và thêm vào danh mục' }));
    expect(within(dialog).getByLabelText('Nhóm')).toHaveAttribute('aria-invalid', 'true');
    expect(within(dialog).getByText('Chọn nhóm cho món mới.')).toBeInTheDocument();
    expect(fetchMock.mock.calls.some((c) => c[0] === '/api/admin/lines/l-1/review')).toBe(false);
  });

  it('server VALIDATION {fields:[item.max_qty]} → lỗi gắn ô "Tối đa mỗi tháng", không báo chung ở đầu hộp', async () => {
    stub(() => jsonResponse(400, { code: 'VALIDATION', message: 'max_qty', fields: ['item.max_qty'] }));
    const { dialog } = await openConvert();
    await userEvent.click(within(dialog).getByRole('radio', { name: 'Văn phòng' }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Mua và thêm vào danh mục' }));
    await waitFor(() => expect(within(dialog).getByLabelText(/^Tối đa mỗi tháng/)).toHaveAttribute('aria-invalid', 'true'));
    expect(within(dialog).getByText('Kiểm tra lại giá trị này.')).toBeInTheDocument();
    expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument();
  });

  it('đổi ĐVT khác dòng gốc → cảnh báo vàng; đổi lại → mất cảnh báo', async () => {
    stub();
    const { dialog } = await openConvert();
    expect(within(dialog).queryByText(/ĐVT khác dòng gốc/)).toBeNull();
    await pickOption(within(dialog).getByLabelText(/^Đơn vị tính/), 'hộp');
    expect(within(dialog).getByText('ĐVT khác dòng gốc (cái) — số lượng 2 sẽ tính theo ĐVT mới.')).toBeInTheDocument();
    await pickOption(within(dialog).getByLabelText(/^Đơn vị tính/), 'cái');
    expect(within(dialog).queryByText(/ĐVT khác dòng gốc/)).toBeNull();
  });

  it('tên trùng sản phẩm đã có (không phân biệt hoa thường, kể cả món ngừng) → một dòng cảnh báo mềm, vẫn gửi món mới', async () => {
    const fetchMock = stub();
    const { dialog, onDone } = await openConvert({ ...LINE, custom_name: 'bút BI' });
    expect(within(dialog).getByText('Đã có sản phẩm cùng tên: Bút bi')).toBeInTheDocument();
    const name = within(dialog).getByLabelText(/^Tên món/);
    await userEvent.clear(name);
    await userEvent.type(name, 'Băng keo cũ ');
    expect(within(dialog).getByText('Đã có sản phẩm cùng tên: Băng keo cũ')).toBeInTheDocument();
    await userEvent.clear(name);
    await userEvent.type(name, 'Bút bi đỏ');
    expect(within(dialog).queryByText(/Đã có sản phẩm cùng tên/)).toBeNull();
    await userEvent.clear(name);
    await userEvent.type(name, 'bút bi');
    await userEvent.click(within(dialog).getByRole('radio', { name: 'Văn phòng' }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Mua và thêm vào danh mục' }));
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(sentBody(fetchMock).item).toMatchObject({ name: 'bút bi', category_id: 'c-1' });
    expect(sentBody(fetchMock).item).not.toHaveProperty('existing_id');
  });

  it('ITEM_INACTIVE (nhóm vừa ngừng) → báo chung ở đầu hộp, hộp vẫn mở', async () => {
    stub(() => jsonResponse(400, { code: 'ITEM_INACTIVE' }));
    const { dialog } = await openConvert();
    await userEvent.click(within(dialog).getByRole('radio', { name: 'Văn phòng' }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Mua và thêm vào danh mục' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Món này đã ngừng — chọn món khác.');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('server báo unit_mismatch → sau khi thêm, khối báo ĐVT đã đổi để kiểm lại số lượng', async () => {
    stub(() => jsonResponse(200, reviewResult('converted', { item_id: 'i-2' }, { unit_mismatch: true })));
    const { dialog } = await openConvert();
    await userEvent.click(within(dialog).getByRole('radio', { name: 'Văn phòng' }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Mua và thêm vào danh mục' }));
    expect(await screen.findByText('ĐVT của món trong danh mục khác dòng gốc — kiểm lại số lượng 2.')).toBeInTheDocument();
  });
});
