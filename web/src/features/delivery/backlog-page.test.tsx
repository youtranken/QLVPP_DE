import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, screen, userEvent, waitFor, within } from '@/test/test-utils';
import { renderApp } from '@/test/render-app';
import { makeMe } from '@/test/fixtures-me';
import { mockViewport } from '@/test/viewport';
import { backlogLine } from './backlog-fixtures';
import { callsTo, stubBacklog } from './backlog-test-stub';

const PEN_DUC = backlogLine();
const PEN_LAN = backlogLine({ line_id: 'l-pen-lan', request_id: 'r-2', user_sub: 'u-lan', full_name: 'Võ Thị Lan', department: null, user_status: 'locked', qty: 1, delivered_qty: 0, remaining_qty: 1 });
const TAPE = backlogLine({ line_id: 'l-tape', item_id: null, name: 'Băng keo 2 mặt', unit: 'cai', qty: 2, delivered_qty: 0, remaining_qty: 2, stock_qty: null });
const EMPTY_STOCK = backlogLine({ line_id: 'l-clip', item_id: 'i-clip', name: 'Kẹp giấy', unit: 'hop', qty: 4, delivered_qty: 0, remaining_qty: 4, stock_qty: 0 });
const SEP = backlogLine({ line_id: 'l-sep', period_ym: '2026-09', request_id: 'r-9', name: 'Giấy A4', item_id: 'i-a4', unit: 'ream', qty: 3, delivered_qty: 0, remaining_qty: 3, stock_qty: 5 });

function openPage(path = '/admin/backlog') {
  mockViewport(1280);
  renderApp(makeMe('admin'), path);
}

const search = () => screen.getByTestId('location-search').textContent ?? '';
const bodyRows = () => screen.getAllByRole('row').filter((r) => within(r).queryByRole('button', { name: /^Lịch sử giao/ }));
const rowOf = (text: string) => bodyRows().find((r) => r.textContent?.includes(text) || within(r).queryAllByRole('button', { name: new RegExp(text) }).length > 0)!;
const monthHeads = () => screen.getAllByRole('row').filter((r) => r.classList.contains('dt-group'));
const personRows = () => screen.getAllByRole('row').filter((r) => r.classList.contains('bl-person'));

afterEach(() => vi.unstubAllGlobals());

describe('BacklogPage — đầu trang gọn', () => {
  it('đúng một h1 "Còn nợ"; một hàng công cụ: chọn tháng, ô tìm, "Chỉ người đã nghỉ"; không thẻ số liệu, không mô tả, không nút Theo món/Theo người; gọi by=person một lần', async () => {
    const f = stubBacklog([PEN_DUC, PEN_LAN]);
    openPage();
    await screen.findAllByText('Bút bi xanh', { selector: '.bl-item b' });
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Còn nợ');
    const bar = screen.getByRole('combobox', { name: 'Tháng nợ' }).closest('.toolbar')!;
    expect(within(bar as HTMLElement).getByRole('searchbox', { name: 'Tìm người hoặc món (không cần dấu)' })).toBeInTheDocument();
    expect(within(bar as HTMLElement).getByRole('switch', { name: 'Chỉ người đã nghỉ (1)' })).toBeInTheDocument();
    expect(screen.queryByText('Tổng còn nợ')).toBeNull();
    expect(screen.queryByText(/Phần chưa giao của các tháng/)).toBeNull();
    expect(screen.queryByRole('radio', { name: 'Theo món' })).toBeNull();
    expect(callsTo(f, '/api/admin/backlog?by=person')).toHaveLength(1);
    expect(screen.queryByText(/đang mở, xem được từ/)).toBeNull();
  });

  it('tải lỗi → "Không tải được dữ liệu — thử lại." + nút "Thử lại"', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(500, {})));
    openPage();
    expect(await screen.findByRole('button', { name: 'Thử lại' })).toBeInTheDocument();
  });

  it('không còn nợ → "Không còn nợ"; lọc không khớp → "Không có dòng nào khớp bộ lọc."', async () => {
    stubBacklog([PEN_DUC]);
    openPage('/admin/backlog?left=1');
    expect(await screen.findByText('Không có dòng nào khớp bộ lọc.')).toBeInTheDocument();
    vi.unstubAllGlobals();
    stubBacklog([]);
    openPage();
    expect(await screen.findAllByText('Không còn nợ')).not.toHaveLength(0);
  });
});

describe('BacklogPage — nhóm tháng → người → món', () => {
  it('bảng kẻ ô: cột Món · ĐVT · Đăng ký · Đã giao · Còn nợ · Tủ còn · Thao tác; hàng nhóm "Tháng 9/2026 · 1 người · 3 đơn vị" trước "Tháng 10/2026 · 2 người · 4 đơn vị"', async () => {
    stubBacklog([PEN_DUC, PEN_LAN, SEP]);
    openPage();
    await screen.findAllByText('Bút bi xanh', { selector: '.bl-item b' });
    expect(screen.getByRole('table')).toHaveClass('grid-table');
    expect(screen.getAllByRole('columnheader').map((c) => c.textContent)).toEqual(['Món', 'ĐVT', 'Đăng ký', 'Đã giao', 'Còn nợ', 'Tủ còn', 'Thao tác']);
    expect(monthHeads().map((r) => r.textContent)).toEqual(['Tháng 9/2026 · 1 người · 3 đơn vị', 'Tháng 10/2026 · 2 người · 4 đơn vị']);
  });

  it('hàng người: tên + phòng ban (hoặc "Chưa có phòng ban") + "Người đã nghỉ"; dòng món có đăng ký 5, đã giao 2, còn nợ 3, tủ 10', async () => {
    stubBacklog([PEN_DUC, PEN_LAN]);
    openPage();
    await screen.findAllByText('Bút bi xanh', { selector: '.bl-item b' });
    expect(personRows().find((r) => r.textContent?.includes('Phạm Văn Đức'))).toHaveTextContent('Tổ Giám sát');
    expect(personRows().find((r) => r.textContent?.includes('Võ Thị Lan'))).toHaveTextContent('Chưa có phòng ban');
    expect(personRows().find((r) => r.textContent?.includes('Võ Thị Lan'))).toHaveTextContent('Người đã nghỉ');
    expect(personRows().find((r) => r.textContent?.includes('Phạm Văn Đức'))).not.toHaveTextContent('Người đã nghỉ');
    const cells = within(rowOf('Phạm Văn Đức')).getAllByRole('cell').map((c) => c.textContent);
    expect(cells.slice(0, 6)).toEqual(['Bút bi xanh', 'cây', '5', '2', '3', '10']);
  });

  it('chọn tháng → ?ym=, chỉ còn tháng đó; "Tất cả tháng" bỏ lọc', async () => {
    stubBacklog([PEN_DUC, SEP]);
    openPage();
    await screen.findAllByText('Bút bi xanh', { selector: '.bl-item b' });
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Tháng nợ' }), 'Tháng 9/2026');
    expect(search()).toContain('ym=2026-09');
    expect(monthHeads()).toHaveLength(1);
    expect(screen.queryByText('Bút bi xanh', { selector: '.bl-item b' })).toBeNull();
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Tháng nợ' }), 'Tất cả tháng');
    expect(search()).not.toContain('ym=');
    expect(monthHeads()).toHaveLength(2);
  });

  it('?ym=2026-10 khôi phục; ?ym=lạ bỏ qua', async () => {
    stubBacklog([PEN_DUC, SEP]);
    openPage('/admin/backlog?ym=2026-10');
    await screen.findAllByText('Bút bi xanh', { selector: '.bl-item b' });
    expect(monthHeads()).toHaveLength(1);
    vi.unstubAllGlobals();
    stubBacklog([PEN_DUC, SEP]);
    openPage('/admin/backlog?ym=xyz');
    await waitFor(() => expect(monthHeads().length).toBeGreaterThan(0));
  });

  it('gõ tìm "gap" khớp tên món không dấu → ?q=, một dòng; "duc" khớp người', async () => {
    stubBacklog([PEN_DUC, SEP, TAPE]);
    openPage();
    await screen.findAllByText('Bút bi xanh', { selector: '.bl-item b' });
    await userEvent.type(screen.getByRole('searchbox', { name: 'Tìm người hoặc món (không cần dấu)' }), 'bang keo');
    await waitFor(() => expect(search()).toContain('q=bang'));
    await waitFor(() => expect(bodyRows()).toHaveLength(1));
    expect(bodyRows()[0]).toHaveTextContent('Băng keo 2 mặt');
  });

  it('công tắc "Chỉ người đã nghỉ" → ?left=1, chỉ người đã nghỉ; bật lại tắt', async () => {
    stubBacklog([PEN_DUC, PEN_LAN, TAPE]);
    openPage();
    await screen.findAllByText('Bút bi xanh', { selector: '.bl-item b' });
    await userEvent.click(screen.getByRole('switch', { name: 'Chỉ người đã nghỉ (1)' }));
    expect(search()).toContain('left=1');
    expect(bodyRows()).toHaveLength(1);
    expect(personRows()).toHaveLength(1);
    await userEvent.click(screen.getByRole('switch', { name: 'Chỉ người đã nghỉ (1)' }));
    expect(search()).not.toContain('left=');
    expect(bodyRows()).toHaveLength(3);
  });

  it('?by=item và ?filter=left cũ bị gỡ khỏi URL (thay thế), filter=left thành left=1; vẫn hiển thị theo tháng', async () => {
    stubBacklog([PEN_DUC, PEN_LAN]);
    openPage('/admin/backlog?by=item&filter=left');
    await waitFor(() => expect(search()).toBe('?left=1'));
    await waitFor(() => expect(bodyRows()).toHaveLength(1));
    expect(monthHeads()).toHaveLength(1);
  });

  it('?by=lạ&filter=lạ → gỡ, không lọc', async () => {
    stubBacklog([PEN_DUC, PEN_LAN]);
    openPage('/admin/backlog?by=xyz&filter=abc');
    await screen.findAllByText('Bút bi xanh', { selector: '.bl-item b' });
    await waitFor(() => expect(search()).toBe(''));
    expect(bodyRows()).toHaveLength(2);
  });

  it('tồn 0 → "Giao bổ sung" tắt kèm lý do "Hết hàng — nhập mua ở Kho rồi giao" + nhãn "Hết hàng" ở dòng; tồn 1 → bật, không lý do; ngoài danh mục không hiện tủ', async () => {
    stubBacklog([EMPTY_STOCK, backlogLine({ line_id: 'l-one', item_id: 'i-one', name: 'Ghim bấm', stock_qty: 1 }), TAPE]);
    openPage();
    await screen.findAllByText('Kẹp giấy', { selector: '.bl-item b' });
    const off = within(rowOf('Kẹp giấy')).getByRole('button', { name: 'Giao bổ sung' });
    expect(off).toBeDisabled();
    expect(off).toHaveAttribute('title', 'Hết hàng — nhập mua ở Kho rồi giao');
    expect(within(rowOf('Kẹp giấy')).getByText('Hết hàng')).toBeInTheDocument();
    const on = within(rowOf('Ghim bấm')).getByRole('button', { name: 'Giao bổ sung' });
    expect(on).toBeEnabled();
    expect(on).not.toHaveAttribute('title');
    expect(within(rowOf('Băng keo 2 mặt')).getAllByRole('cell')[5]).toHaveTextContent('—');
  });

  it('không có chữ rời rạc ở đầu bảng: mỗi hàng nhóm là một câu liền "… · n người · m đơn vị"', async () => {
    stubBacklog([PEN_DUC, PEN_LAN]);
    openPage();
    await screen.findAllByText('Bút bi xanh', { selector: '.bl-item b' });
    for (const head of monthHeads()) expect(head.textContent).toMatch(/^Tháng \d+\/\d{4} · \d+ người · \d+ đơn vị$/);
  });

  it('390: bảng xếp chồng (table-stack), nút "Giao bổ sung" và menu ⋯ cùng một ô thao tác', async () => {
    stubBacklog([PEN_DUC]);
    mockViewport(390);
    renderApp(makeMe('admin'), '/admin/backlog');
    const more = await screen.findByRole('button', { name: 'Thao tác khác Bút bi xanh — Phạm Văn Đức' });
    expect(screen.getByRole('table')).toHaveClass('table-stack');
    expect(more.closest('.bl-acts')).toContainElement(screen.getByRole('button', { name: 'Giao bổ sung' }));
  });
});
