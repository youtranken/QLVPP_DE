import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, screen, userEvent, waitFor, within } from '@/test/test-utils';
import { renderApp } from '@/test/render-app';
import { makeMe } from '@/test/fixtures-me';
import { lineView } from '@/test/fixtures-request';
import { mockViewport } from '@/test/viewport';
import { adminItem } from '@/features/summary/adjust-fixtures';
import { NOTE_LINE, PEN_LINE, deliveryItems, deliveryRequest } from './delivery-fixtures';
import { countOf, stubDelivery } from './delivery-test-stub';

const item = (name: string, unit: string) => ({ name, name_en: null, unit, pack_note: null, image_file_id: null, active: true, admin_only: false });

// Biên Thực giao: max = min(còn lại, tồn); ngoài DM max = còn lại; tồn 0 → không giao được
const BOUNDARY = deliveryRequest({
  lines: [
    lineView({ id: 'l-a', item_id: 'i-a', item: item('Bìa lá', 'bich'), qty: 5 }),
    lineView({ id: 'l-b', item_id: 'i-b', item: item('Kim bấm', 'hop'), qty: 2 }),
    lineView({ id: 'l-c', custom_name: 'Băng keo giấy', custom_unit: 'cuon', qty: 4, review_status: 'accepted' }),
    lineView({ id: 'l-d', item_id: 'i-d', item: item('Bút chì', 'cay'), qty: 5 }),
    lineView({ id: 'l-e', item_id: 'i-b', item: item('Kim bấm lớn', 'hop'), qty: 1, delivered_qty: 1 }),
  ],
});
const BOUNDARY_ITEMS = [
  adminItem({ id: 'i-a', name: 'Bìa lá', unit: 'bich', stock_qty: 3 }),
  adminItem({ id: 'i-b', name: 'Kim bấm', unit: 'hop', stock_qty: 10 }),
  adminItem({ id: 'i-d', name: 'Bút chì', unit: 'cay', stock_qty: 0 }),
];

const rowOf = (name: string) => within(screen.getByRole('table', { name: /^Các dòng của phiếu/ })).getByRole('row', { name: new RegExp(name) });
const qtyOf = (name: string) => screen.getByRole('spinbutton', { name: `Thực giao ${name}` });

async function openDetail() {
  mockViewport(1280);
  renderApp(makeMe('admin'), '/admin/delivery/classic?request=r-1');
  return screen.findByRole('table', { name: 'Các dòng của phiếu Phạm Văn Đức' });
}

afterEach(() => vi.unstubAllGlobals());

describe('DeliveryDetail — đầu chi tiết và các dòng', () => {
  it('đầu: phòng ban + "lưu phiếu lúc", "đã giao 3/8 đơn vị" (cùng số với danh sách, bỏ dòng chờ xem/từ chối); dòng chờ xem có liên kết Xem, dòng từ chối có badge', async () => {
    stubDelivery();
    const table = await openDetail();
    expect(screen.getByRole('heading', { level: 2, name: 'Phạm Văn Đức' })).toBeInTheDocument();
    expect(screen.getByText('Tổ Giám sát · lưu phiếu lúc 14:20 05/10')).toBeInTheDocument();
    const head = screen.getByRole('heading', { level: 2, name: 'Phạm Văn Đức' }).closest('header')!;
    expect(within(head).getByText('đã giao 3/8 đơn vị')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'đã giao 3/8 đơn vị' })).toBeInTheDocument();
    const pen = rowOf('Bút bi xanh');
    expect(within(pen).getAllByRole('cell').map((c) => c.textContent)).toEqual(expect.arrayContaining(['5', '3', '10']));
    expect(qtyOf('Bút bi xanh')).toHaveValue(2);
    expect(within(table).getByText('Chờ xem — chưa giao được')).toBeInTheDocument();
    expect(within(table).getByRole('link', { name: 'Xem' })).toHaveAttribute('href', '/admin/review?status=pending&ym=2026-10');
    expect(within(table).getByText('Đã từ chối')).toBeInTheDocument();
  });

  it('còn 5 tồn 3 → max 3, ở 3 nút + vô hiệu; còn 2 tồn 10 → max 2; ngoài DM còn 4 → max 4, tồn "—"', async () => {
    stubDelivery({ views: [BOUNDARY], items: BOUNDARY_ITEMS });
    await openDetail();
    expect(qtyOf('Bìa lá')).toHaveValue(3);
    expect(screen.getByRole('button', { name: 'Thêm Bìa lá' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Bớt Bìa lá' }));
    expect(qtyOf('Bìa lá')).toHaveValue(2);
    expect(screen.getByRole('button', { name: 'Thêm Bìa lá' })).toBeEnabled();
    expect(qtyOf('Kim bấm')).toHaveValue(2);
    expect(screen.getByRole('button', { name: 'Thêm Kim bấm' })).toBeDisabled();
    expect(qtyOf('Băng keo giấy')).toHaveValue(4);
    expect(screen.getByRole('button', { name: 'Thêm Băng keo giấy' })).toBeDisabled();
    expect(within(rowOf('Băng keo giấy')).getByText('—')).toBeInTheDocument();
  });

  it('min 1: ở 1 nút − vô hiệu', async () => {
    stubDelivery({ views: [BOUNDARY], items: BOUNDARY_ITEMS });
    await openDetail();
    await userEvent.click(screen.getByRole('button', { name: 'Bớt Kim bấm' }));
    expect(qtyOf('Kim bấm')).toHaveValue(1);
    expect(screen.getByRole('button', { name: 'Bớt Kim bấm' })).toBeDisabled();
  });

  it('tồn 0 → "Hết hàng — chưa nhận 5", stepper và Giao vô hiệu; cảnh báo "2 dòng thiếu kho…"; dòng đủ → "Đã giao đủ"', async () => {
    stubDelivery({ views: [BOUNDARY], items: BOUNDARY_ITEMS });
    await openDetail();
    const pencil = rowOf('Bút chì');
    expect(within(pencil).getByText('Hết hàng — chưa nhận 5')).toBeInTheDocument();
    expect(qtyOf('Bút chì')).toBeDisabled();
    expect(within(pencil).getByRole('button', { name: 'Thêm Bút chì' })).toBeDisabled();
    expect(within(pencil).getByRole('button', { name: 'Giao Bút chì' })).toBeDisabled();
    expect(within(pencil).getByRole('checkbox', { name: 'Chọn Bút chì' })).toBeDisabled();
    expect(screen.getByText('2 dòng thiếu kho. Giao phần đang có; phần còn lại chờ hàng về.')).toBeInTheDocument();
    expect(within(rowOf('Kim bấm lớn')).getByText('Đã giao đủ')).toBeInTheDocument();
    expect(within(rowOf('Kim bấm lớn')).queryByRole('spinbutton')).toBeNull();
  });
});

describe('DeliveryDetail — giao một dòng', () => {
  it('Giao Bút bi xanh → POST {qty 2, expected_delivered_qty 3}, toast "Đã giao 2 cây Bút bi xanh"', async () => {
    const f = stubDelivery({ deliver: () => jsonResponse(200, { line: {}, request_complete: false }) });
    await openDetail();
    await userEvent.click(screen.getByRole('button', { name: 'Giao Bút bi xanh' }));
    expect(await screen.findByText('Đã giao 2 cây Bút bi xanh')).toBeInTheDocument();
    const post = f.mock.calls.find((c) => c[0] === '/api/admin/lines/l-pen/deliver')!;
    expect(JSON.parse(String(post[1]?.body))).toEqual({ qty: 2, expected_delivered_qty: 3 });
  });

  it('STOCK_INSUFFICIENT {available: 2} → "Chỉ còn 2 bịch." trong dòng, stepper kẹp về 2, + vô hiệu', async () => {
    stubDelivery({ deliver: () => jsonResponse(409, { code: 'STOCK_INSUFFICIENT', message: 'x', available: 2 }) });
    await openDetail();
    expect(qtyOf('Giấy note vàng')).toHaveValue(3);
    await userEvent.click(screen.getByRole('button', { name: 'Giao Giấy note vàng' }));
    const note = rowOf('Giấy note vàng');
    expect(await within(note).findByText('Chỉ còn 2 bịch.')).toBeInTheDocument();
    expect(qtyOf('Giấy note vàng')).toHaveValue(2);
    expect(qtyOf('Giấy note vàng')).toHaveAccessibleDescription('Chỉ còn 2 bịch.');
    expect(within(note).getByRole('button', { name: 'Thêm Giấy note vàng' })).toBeDisabled();
  });

  it('STALE_UPDATE → câu trong dòng "Dòng vừa được giao ở nơi khác — đã cập nhật." + tải lại phiếu', async () => {
    const fresh = deliveryRequest({ lines: [{ ...PEN_LINE, delivered_qty: 4 }, NOTE_LINE] });
    const f = stubDelivery({ views: [deliveryRequest(), fresh], deliver: () => jsonResponse(409, { code: 'STALE_UPDATE', message: 'x', delivered_qty: 4 }) });
    await openDetail();
    await userEvent.click(screen.getByRole('button', { name: 'Giao Bút bi xanh' }));
    expect(await within(rowOf('Bút bi xanh')).findByText('Dòng vừa được giao ở nơi khác — đã cập nhật.')).toBeInTheDocument();
    expect(countOf(f, '/api/admin/requests/r-1')).toBe(2);
    expect(qtyOf('Bút bi xanh')).toHaveValue(1);
  });

  it('DELIVER_EXCEEDS_QTY {remaining: 1} → "Chỉ còn 1 chưa giao." + tải lại phiếu', async () => {
    const fresh = deliveryRequest({ lines: [{ ...PEN_LINE, cancelled_qty: 1 }, NOTE_LINE] });
    const f = stubDelivery({ views: [deliveryRequest(), fresh], deliver: () => jsonResponse(400, { code: 'DELIVER_EXCEEDS_QTY', message: 'x', remaining: 1 }) });
    await openDetail();
    await userEvent.click(screen.getByRole('button', { name: 'Giao Bút bi xanh' }));
    expect(await within(rowOf('Bút bi xanh')).findByText('Chỉ còn 1 chưa giao.')).toBeInTheDocument();
    expect(countOf(f, '/api/admin/requests/r-1')).toBe(2);
    expect(within(rowOf('Bút bi xanh')).getByText('đã hủy 1')).toBeInTheDocument();
  });

  it('PERIOD_NOT_LOCKED → khối đầu chi tiết "Kỳ chưa khóa — giao sau 00:00 ngày 11/10."', async () => {
    stubDelivery({ deliver: () => jsonResponse(409, { code: 'PERIOD_NOT_LOCKED', message: 'x' }) });
    await openDetail();
    await userEvent.click(screen.getByRole('button', { name: 'Giao Bút bi xanh' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Kỳ chưa khóa — giao sau 00:00 ngày 11/10.');
  });

  it('dòng mới tải lại có phần còn lại khác → stepper đặt lại theo max mới', async () => {
    const fresh = deliveryRequest({ lines: [{ ...PEN_LINE, qty: 7 }, { ...NOTE_LINE, delivered_qty: 3 }] });
    stubDelivery({ views: [deliveryRequest(), fresh], deliver: () => jsonResponse(200, { line: {} }) });
    await openDetail();
    await userEvent.click(screen.getByRole('button', { name: 'Giao Giấy note vàng' }));
    await waitFor(() => expect(qtyOf('Bút bi xanh')).toHaveValue(4));
  });
});

describe('DeliveryDetail — chân: chọn dòng', () => {
  it('chưa chọn → chỉ nút "Giao dòng đã chọn (0)" vô hiệu, không lặp "Đã chọn 0 dòng"; chọn 1 → (1) bật', async () => {
    stubDelivery({ items: deliveryItems() });
    await openDetail();
    expect(screen.getByRole('button', { name: 'Giao dòng đã chọn (0)' })).toBeDisabled();
    expect(screen.queryByText(/^Đã chọn \d+ dòng$/)).toBeNull();
    await userEvent.click(screen.getByRole('checkbox', { name: 'Chọn Bút bi xanh' }));
    expect(screen.getByRole('button', { name: 'Giao dòng đã chọn (1)' })).toBeEnabled();
  });
});
