import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, userEvent, within } from '@/test/test-utils';
import { itemRow, sendReport, sentData, sentState, setupSendAdm, YM } from '@/features/send-adm/send-adm-fixtures';

import { PAPER, PEN, REPORT, SENT, open, qtyBox, statuses } from './report-send-page-fixtures';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Báo cáo & gửi NCC: đầu trang và trạng thái', () => {
  it('AD-16 AD-19 đầu trang chỉ h1; thanh công cụ có ‹ Tháng 10/2026 ›, công tắc "Chỉ món có Tổng cần", Xuất Excel, nút chính "In trình ký"', async () => {
    setupSendAdm({ report: REPORT });
    open();
    expect(await screen.findByRole('heading', { level: 1, name: 'Báo cáo & gửi NCC' })).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    const bar = await screen.findByRole('toolbar', { name: 'Thanh công cụ Báo cáo' });
    expect(within(within(bar).getByRole('group', { name: 'Chọn tháng báo cáo' })).getByText('Tháng 10/2026')).toBeInTheDocument();
    const only = within(bar).getByRole('switch', { name: 'Chỉ món có Tổng cần' });
    expect(only).toHaveAttribute('aria-checked', 'false');
    expect(within(bar).getByRole('button', { name: 'Xuất Excel' })).toBeInTheDocument();
    expect(within(bar).getByRole('button', { name: 'In trình ký' })).toHaveClass('btn--primary');
    expect(screen.queryByRole('button', { name: 'Xem tổng kết' })).toBeNull();
    expect(screen.getByRole('heading', { level: 1 }).closest('.bc-head')).not.toContainElement(bar);
  });

  it('AD-15 không còn nút tắt dài "Tháng 11 đang đăng ký — …"; nút › tắt, lý do nằm ở chú thích (aria-describedby)', async () => {
    setupSendAdm({ report: REPORT });
    open();
    const bar = await screen.findByRole('toolbar', { name: 'Thanh công cụ Báo cáo' });
    expect(screen.queryByRole('button', { name: /đang đăng ký/ })).toBeNull();
    const next = within(bar).getByRole('button', { name: 'Tháng sau' });
    expect(next).toBeDisabled();
    const why = /^Tháng 11 đang đăng ký — báo cáo sau 00:00\sngày\s11\/11$/;
    expect(next).toHaveAccessibleDescription(why);
    expect(next.getAttribute('title')).toMatch(why);
  });

  it('bật "Chỉ món có Tổng cần" → chỉ còn hàng có Tổng cần > 0', async () => {
    setupSendAdm({ report: sendReport([PEN, itemRow({ key: 'kZ', name: 'Kẹp giấy', requested: 0, need: 0 })]) });
    open();
    expect(await qtyBox('Kẹp giấy')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('switch', { name: 'Chỉ món có Tổng cần' }));
    expect(screen.getByRole('switch', { name: 'Chỉ món có Tổng cần' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.queryByRole('spinbutton', { name: 'Đề nghị: Kẹp giấy' })).toBeNull();
    expect(screen.getByRole('spinbutton', { name: 'Đề nghị: Bút bi' })).toBeInTheDocument();
  });

  it('dấu "·" giữa các phần trạng thái chỉ để nhìn (aria-hidden), không đứng lẻ đầu dòng khi xuống dòng', async () => {
    setupSendAdm({ report: sendReport([PEN, PAPER], { pending_custom_count: 1 }), state: SENT });
    open();
    await qtyBox('Bút bi');
    const status = statuses()[0]!;
    const seps = status.querySelectorAll('.bc-status__sep');
    expect(seps.length).toBeGreaterThan(0);
    seps.forEach((s) => expect(s).toHaveAttribute('aria-hidden', 'true'));
  });

  it('lúc đang tải: đầu trang cùng khung h1 + đường dẫn với lúc tải xong để tiêu đề không nhảy', async () => {
    setupSendAdm({ report: REPORT });
    open();
    const h1 = screen.getByRole('heading', { level: 1, name: 'Báo cáo & gửi NCC' });
    expect(h1.closest('.bc-head')).not.toBeNull();
    expect(h1.previousElementSibling).toHaveTextContent('Hằng thángBáo cáo & gửi NCC');
    await qtyBox('Bút bi');
    const loaded = screen.getByRole('heading', { level: 1, name: 'Báo cáo & gửi NCC' });
    expect(loaded.closest('.bc-head')).not.toBeNull();
    expect(loaded.previousElementSibling).toHaveTextContent('Hằng thángBáo cáo & gửi NCC');
  });

  it('AD-17 đã gửi: đúng một dòng trạng thái "Đã gửi NCC 09:02 12/12", thanh công cụ không có "In lại"', async () => {
    setupSendAdm({ report: REPORT, state: SENT });
    open();
    await screen.findByRole('spinbutton', { name: 'Đề nghị: Bút bi' });
    const status = statuses();
    expect(status).toHaveLength(1);
    expect(status[0]).toHaveTextContent('Đã gửi NCC 09:02 12/12');
    expect(within(screen.getByRole('toolbar', { name: 'Thanh công cụ Báo cáo' })).queryByRole('button', { name: /In lại/ })).toBeNull();
    expect(screen.queryByText(/\d+ món, \d+ đơn vị/)).toBeNull();
  });

  it('trạng thái nằm trên thanh công cụ, trước nút Xuất Excel; không còn dòng "Không in kèm phụ lục" / hướng dẫn hộp in', async () => {
    setupSendAdm({ report: REPORT, state: SENT });
    open();
    await qtyBox('Bút bi');
    const status = statuses()[0]!;
    expect(screen.getByRole('toolbar', { name: 'Thanh công cụ Báo cáo' })).toContainElement(status);
    const excel = screen.getByRole('button', { name: 'Xuất Excel' });
    expect(status.compareDocumentPosition(excel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByText('Không in kèm phụ lục')).toBeNull();
    expect(screen.queryByText(/Trong hộp in/)).toBeNull();
  });

  it('AD-18 có 1 món đổi sau bản đã gửi → chip "Đã đổi sau bản in (1)" và nhãn "Đổi sau bản in" ở đúng hàng', async () => {
    const changed = sendReport([PEN, itemRow({ key: 'kB', name: 'Giấy A4', requested: 4, need: 4 })]);
    setupSendAdm({ report: changed, state: sentState(sentData(REPORT, { kA: 5, kB: 3 })) });
    open();
    await screen.findByRole('spinbutton', { name: 'Đề nghị: Bút bi' });
    expect(screen.queryByText(/món đổi sau bản này/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Đã đổi sau bản in (1)' })).toHaveClass('flt-chip');
    const rows = screen.getAllByRole('row');
    expect(within(rows.find((r) => r.textContent?.includes('Giấy A4'))!).getByText('Đổi sau bản in: 3 → 4')).toBeInTheDocument();
    expect(within(rows.find((r) => r.textContent?.includes('Bút bi'))!).queryByText(/Đổi sau bản in/)).toBeNull();
  });

  it('AD-18 chip có aria-pressed: bấm → bảng chỉ còn dòng đổi; bấm lại → đủ dòng; không đổi gì (0) → không có chip', async () => {
    const changed = sendReport([PEN, itemRow({ key: 'kB', name: 'Giấy A4', requested: 4, need: 4 })]);
    setupSendAdm({ report: changed, state: sentState(sentData(REPORT, { kA: 5, kB: 3 })) });
    open();
    await screen.findByRole('spinbutton', { name: 'Đề nghị: Bút bi' });
    const only = screen.getByRole('button', { name: 'Đã đổi sau bản in (1)' });
    expect(only).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(only);
    expect(only).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByRole('spinbutton', { name: 'Đề nghị: Bút bi' })).toBeNull();
    expect(screen.getByRole('spinbutton', { name: 'Đề nghị: Giấy A4' })).toBeInTheDocument();
    await userEvent.click(only);
    expect(screen.getByRole('spinbutton', { name: 'Đề nghị: Bút bi' })).toBeInTheDocument();
  });

  it('AD-18 đã gửi, không món nào đổi → không có chip "Đã đổi sau bản in"', async () => {
    setupSendAdm({ report: REPORT, state: SENT });
    open();
    await qtyBox('Bút bi');
    expect(screen.queryByRole('button', { name: /^Đã đổi sau bản in/ })).toBeNull();
  });

  it('chưa gửi: "Chưa gửi NCC"; có món ngoài DM chờ duyệt → không ghi "n món … chờ duyệt", chỉ còn link "Xem" (nhãn đủ nghĩa)', async () => {
    setupSendAdm({ report: sendReport([PEN, PAPER], { pending_custom_count: 2 }) });
    open();
    await screen.findByText('Chưa gửi NCC');
    const status = statuses()[0]!;
    expect(status).toHaveTextContent('Chưa gửi NCC');
    expect(status).not.toHaveTextContent('chờ duyệt');
    expect(within(status).getByRole('link', { name: 'Xem 2 món ngoài danh mục chờ duyệt' })).toHaveAttribute('href', `/admin/review?status=pending&ym=${YM}`);
  });
});

