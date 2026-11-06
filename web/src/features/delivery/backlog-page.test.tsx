import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, screen, userEvent, within } from '@/test/test-utils';
import { renderApp } from '@/test/render-app';
import { makeMe } from '@/test/fixtures-me';
import { mockViewport } from '@/test/viewport';
import { backlogLine } from './backlog-fixtures';
import { callsTo, stubBacklog } from './backlog-test-stub';

const PEN_DUC = backlogLine();
const PEN_LAN = backlogLine({ line_id: 'l-pen-lan', request_id: 'r-2', user_sub: 'u-lan', full_name: 'Võ Thị Lan', department: null, user_status: 'locked', qty: 1, delivered_qty: 0, remaining_qty: 1 });
const TAPE = backlogLine({ line_id: 'l-tape', item_id: null, name: 'Băng keo 2 mặt', unit: 'cai', qty: 2, delivered_qty: 0, remaining_qty: 2, stock_qty: null });
const EMPTY_STOCK = backlogLine({ line_id: 'l-clip', item_id: 'i-clip', name: 'Kẹp giấy', unit: 'hop', qty: 4, delivered_qty: 0, remaining_qty: 4, stock_qty: 0 });

function openPage(path = '/admin/backlog') {
  mockViewport(1280);
  renderApp(makeMe('admin'), path);
}

const bodyRows = () => screen.getAllByRole('row').filter((r) => within(r).queryByRole('button', { name: /^Lịch sử giao/ }));
const rowOf = (text: string) => bodyRows().find((r) => r.textContent?.includes(text))!;
const heads = () => screen.getAllByRole('row').filter((r) => r.classList.contains('dt-group'));
const headOf = (text: string) => heads().find((r) => r.textContent?.includes(text))!;
const card = (name: RegExp) => screen.getByRole('button', { name });

afterEach(() => vi.unstubAllGlobals());

describe('BacklogPage — đầu trang, thẻ, bộ lọc', () => {
  it('đúng một h1 "Còn nợ" + mô tả theo tháng đang giao (kỳ mở 11 → tháng 10); "Theo món" mặc định, gọi by=item', async () => {
    const f = stubBacklog([PEN_DUC]);
    openPage();
    await screen.findByText('Bút bi xanh');
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Còn nợ');
    expect(await screen.findByText('Phần chưa giao của các tháng trước tháng 10 — giao bổ sung khi có hàng, hoặc hủy nợ.')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Theo món' })).toHaveAttribute('aria-checked', 'true');
    expect(callsTo(f, '/api/admin/backlog?by=item')).toHaveLength(1);
  });

  it('thẻ: tổng còn nợ 6 đơn vị "3 dòng · 3 người"; "Có hàng" đếm cả dòng ngoài danh mục (3), không đếm tồn 0; "Của người đã nghỉ" 1', async () => {
    stubBacklog([PEN_DUC, PEN_LAN, TAPE, EMPTY_STOCK]);
    openPage();
    await screen.findByText('Bút bi xanh');
    const total = screen.getByText('Tổng còn nợ').closest('.stat-card')!;
    expect(total).toHaveTextContent('10');
    expect(total).toHaveTextContent('4 dòng · 2 người');
    expect(total.tagName).toBe('DIV');
    expect(card(/Có hàng để giao bổ sung/)).toHaveTextContent('3');
    expect(card(/Có hàng để giao bổ sung/).querySelector('.stat-card__sub')).toHaveTextContent(/^có thể giao ngay$/);
    expect(card(/Của người đã nghỉ/)).toHaveTextContent('1');
  });

  it('bấm thẻ "Của người đã nghỉ" → ?filter=left, chỉ dòng có nhãn "Người đã nghỉ", thông báo lọc + "Bỏ lọc" trả đủ dòng', async () => {
    stubBacklog([PEN_DUC, PEN_LAN, TAPE]);
    openPage();
    await screen.findByText('Bút bi xanh');
    await userEvent.click(card(/Của người đã nghỉ/));
    expect(screen.getByTestId('location-search')).toHaveTextContent('?filter=left');
    expect(card(/Của người đã nghỉ/)).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Đang lọc: Của người đã nghỉ · 1')).toBeInTheDocument();
    expect(bodyRows()).toHaveLength(1);
    expect(within(bodyRows()[0]).getByText('Người đã nghỉ')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Bỏ lọc' }));
    expect(bodyRows()).toHaveLength(3);
    expect(screen.getByTestId('location-search')).toHaveTextContent('');
  });

  it('?filter=available → bỏ dòng tồn 0, giữ dòng ngoài danh mục; bấm lại thẻ → bỏ lọc', async () => {
    stubBacklog([PEN_DUC, TAPE, EMPTY_STOCK]);
    openPage('/admin/backlog?filter=available');
    await screen.findByText('Bút bi xanh');
    expect(bodyRows()).toHaveLength(2);
    expect(screen.queryByText('Kẹp giấy')).toBeNull();
    expect(screen.getByText('Băng keo 2 mặt')).toBeInTheDocument();
    await userEvent.click(card(/Có hàng để giao bổ sung/));
    expect(bodyRows()).toHaveLength(3);
  });

  it('lọc ra không còn dòng → "Không có dòng nào khớp bộ lọc."; không lọc mà trống → "Không còn nợ"', async () => {
    stubBacklog([PEN_DUC]);
    openPage('/admin/backlog?filter=left');
    expect(await screen.findByText('Không có dòng nào khớp bộ lọc.')).toBeInTheDocument();
    vi.unstubAllGlobals();
    stubBacklog([]);
    openPage();
    expect(await screen.findAllByText('Không còn nợ')).not.toHaveLength(0);
  });

  it('?filter=lạ và ?by=lạ → bỏ qua (theo món, không lọc)', async () => {
    stubBacklog([PEN_DUC, PEN_LAN]);
    openPage('/admin/backlog?by=xyz&filter=abc');
    await screen.findByText('Bút bi xanh');
    expect(bodyRows()).toHaveLength(2);
    expect(screen.getByRole('radio', { name: 'Theo món' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.queryByText(/^Đang lọc/)).toBeNull();
  });

  it('tải lỗi → "Không tải được dữ liệu — thử lại." + nút "Thử lại"', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(500, {})));
    openPage();
    expect(await screen.findByRole('button', { name: 'Thử lại' })).toBeInTheDocument();
  });
});

describe('BacklogPage — nhóm và dòng', () => {
  it('theo món: tiêu đề nhóm "còn 4 cây", "Tủ còn 10"; cột "Tủ còn" (10); dòng "Phạm Văn Đức · Tổ Giám sát", "Tháng 10/2026", "Còn 3 cây", "/ đặt 5"', async () => {
    stubBacklog([PEN_DUC, PEN_LAN]);
    openPage();
    await screen.findByText('Bút bi xanh');
    const head = headOf('Bút bi xanh');
    expect(head).toHaveTextContent('còn 4 cây');
    expect(head).toHaveTextContent('Tủ còn 10');
    expect(screen.getByRole('columnheader', { name: 'Tủ còn' })).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Tồn' })).toBeNull();
    const row = rowOf('Phạm Văn Đức');
    expect(within(row).getByRole('cell', { name: '10' })).toBeInTheDocument();
    expect(row).toHaveTextContent('Tổ Giám sát');
    expect(row).toHaveTextContent('Tháng 10/2026');
    expect(row).toHaveTextContent('Còn 3 cây');
    expect(row).toHaveTextContent('/ đặt 5');
    expect(within(rowOf('Võ Thị Lan')).getByText('Người đã nghỉ')).toBeInTheDocument();
    expect(within(row).queryByText('Người đã nghỉ')).toBeNull();
  });

  it('theo món, nhóm hết hàng: "Hết hàng" chỉ ở tiêu đề (không lặp ở dòng), "Giao bổ sung" vô hiệu, menu ⋯ (chứa Hủy nợ) bấm được; ngoài danh mục không hiện tủ', async () => {
    stubBacklog([EMPTY_STOCK, TAPE]);
    openPage();
    await screen.findByText('Kẹp giấy');
    expect(headOf('Kẹp giấy')).toHaveTextContent('Hết hàng');
    expect(headOf('Băng keo 2 mặt')).not.toHaveTextContent(/Tủ còn|Hết hàng/);
    const clip = bodyRows().find((r) => r.textContent?.includes('Phạm Văn Đức') && r.textContent.includes('Còn 4'))!;
    expect(within(clip).getByRole('button', { name: 'Giao bổ sung' })).toBeDisabled();
    expect(within(clip).getByRole('button', { name: 'Thao tác khác Kẹp giấy — Phạm Văn Đức' })).toBeEnabled();
    expect(within(clip).queryByText('Hết hàng')).toBeNull();
  });

  it('theo người: "Hết hàng" ở dòng của món hết hàng, không ở tiêu đề người', async () => {
    stubBacklog([EMPTY_STOCK, PEN_DUC]);
    openPage('/admin/backlog?by=person');
    await screen.findByText('Kẹp giấy');
    expect(headOf('Phạm Văn Đức')).not.toHaveTextContent('Hết hàng');
    expect(within(rowOf('Kẹp giấy')).getByText('Hết hàng')).toBeInTheDocument();
    expect(within(rowOf('Bút bi xanh')).queryByText('Hết hàng')).toBeNull();
  });

  it('theo người: tiêu đề nhóm có phòng ban (hoặc "Chưa có phòng ban") + "Người đã nghỉ"; dòng ghi tên món', async () => {
    const f = stubBacklog([PEN_DUC, PEN_LAN]);
    openPage();
    await screen.findByText('Bút bi xanh');
    await userEvent.click(screen.getByRole('radio', { name: 'Theo người' }));
    expect(screen.getByTestId('location-search')).toHaveTextContent('?by=person');
    await screen.findByText('Chưa có phòng ban');
    expect(callsTo(f, '/api/admin/backlog?by=person')).toHaveLength(1);
    expect(headOf('Võ Thị Lan')).toHaveTextContent('Người đã nghỉ');
    expect(headOf('Phạm Văn Đức')).toHaveTextContent('Tổ Giám sát');
    expect(headOf('Phạm Văn Đức')).not.toHaveTextContent('Người đã nghỉ');
    expect(rowOf('Bút bi xanh')).toHaveTextContent('Tháng 10/2026');
  });

  it('lọc "Của người đã nghỉ": tiêu đề nhóm món vẫn ghi tổng nợ của API (còn 4), dòng chỉ còn người đã nghỉ; nút lịch sử nêu món và người', async () => {
    stubBacklog([PEN_DUC, PEN_LAN]);
    openPage('/admin/backlog?filter=left');
    await screen.findByText('Bút bi xanh');
    expect(headOf('Bút bi xanh')).toHaveTextContent('còn 4 cây');
    expect(bodyRows()).toHaveLength(1);
    expect(within(bodyRows()[0]).getByRole('button', { name: 'Lịch sử giao Bút bi xanh — Võ Thị Lan' })).toBeInTheDocument();
  });

  it('đổi Theo người giữ bộ lọc đang bật', async () => {
    stubBacklog([PEN_DUC, PEN_LAN]);
    openPage('/admin/backlog?filter=left');
    await screen.findByText('Bút bi xanh');
    await userEvent.click(screen.getByRole('radio', { name: 'Theo người' }));
    expect(screen.getByTestId('location-search')).toHaveTextContent('by=person');
    expect(screen.getByTestId('location-search')).toHaveTextContent('filter=left');
  });
});

describe('BacklogPage — bố cục sau rà UX', () => {
  it('nút "Theo món/Theo người" ở thanh công cụ dưới hàng ô số liệu', async () => {
    stubBacklog([PEN_DUC]);
    openPage();
    await screen.findByText('Bút bi xanh');
    const view = screen.getByRole('radiogroup', { name: 'Nhóm theo' });
    expect(view.closest('.toolbar')).not.toBeNull();
    const stats = screen.getByText('Tổng còn nợ').closest('.stat-row')!;
    expect(stats.compareDocumentPosition(view) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('tồn 0 → "Giao bổ sung" tắt kèm lý do "Hết hàng — nhập mua ở Kho rồi giao"; tồn 1 → bật, không lý do', async () => {
    stubBacklog([EMPTY_STOCK, backlogLine({ line_id: 'l-one', item_id: 'i-one', name: 'Ghim bấm', stock_qty: 1 })]);
    openPage('/admin/backlog?by=person');
    await screen.findByText('Kẹp giấy');
    const off = within(rowOf('Kẹp giấy')).getByRole('button', { name: 'Giao bổ sung' });
    expect(off).toBeDisabled();
    expect(off).toHaveAttribute('title', 'Hết hàng — nhập mua ở Kho rồi giao');
    const on = within(rowOf('Ghim bấm')).getByRole('button', { name: 'Giao bổ sung' });
    expect(on).toBeEnabled();
    expect(on).not.toHaveAttribute('title');
  });

  it('390: ô còn nợ ghi "Còn 3 cây / đặt 5", không lặp nhãn "Còn nợ" trước số', async () => {
    stubBacklog([PEN_DUC]);
    mockViewport(390);
    renderApp(makeMe('admin'), '/admin/backlog');
    const owed = (await screen.findByText('Còn 3 cây')).closest('td')!;
    expect(owed).toHaveTextContent('Còn 3 cây/ đặt 5');
    expect(owed.getAttribute('data-label') ?? '').toBe('');
  });
});
