import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, userEvent, within } from '@/test/test-utils';
import { itemRow, sendReport, sentData, sentState, setupSendAdm, YM } from '@/features/send-adm/send-adm-fixtures';

import { PAPER, PEN, REPORT, SENT, open, qtyBox, statuses } from './report-send-page-fixtures';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Báo cáo & gửi NCC: đầu trang và trạng thái', () => {
  it('một hàng đầu trang: h1, ‹ Tháng 10/2026 ›, công tắc "Chỉ món có Tổng cần", Xuất Excel, Xem tổng kết (không còn "In trình ký")', async () => {
    setupSendAdm({ report: REPORT });
    open();
    expect(await screen.findByRole('heading', { level: 1, name: 'Báo cáo & gửi NCC' })).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(await screen.findByText('Tháng 10/2026')).toBeInTheDocument();
    // Công tắc Switch dùng chung (giống Nhận hàng), không còn checkbox trình duyệt
    const only = screen.getByRole('switch', { name: 'Chỉ món có Tổng cần' });
    expect(only).toHaveAttribute('aria-checked', 'false');
    expect(screen.queryByRole('checkbox', { name: 'Chỉ món có Tổng cần' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Xuất Excel' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Xem tổng kết' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'In trình ký' })).toBeNull();
    // Cạnh nút › (tắt): kỳ đang mở ghi rõ còn đăng ký, báo cáo sau khi khóa — không còn "Đang mở" dễ hiểu nhầm là báo cáo được
    const beyond = screen.getByRole('button', { name: /đang đăng ký/ });
    expect(beyond).toHaveTextContent('Tháng 11 đang đăng ký — báo cáo sau 00:00 ngày 11/11');
    expect(beyond).toBeDisabled();
    expect(screen.queryByText('Đang mở')).toBeNull();
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
    setupSendAdm({ report: REPORT, state: SENT });
    open();
    await qtyBox('Bút bi');
    const status = statuses()[0]!;
    const seps = status.querySelectorAll('.bc-status__sep');
    expect(seps.length).toBeGreaterThan(0);
    seps.forEach((s) => expect(s).toHaveAttribute('aria-hidden', 'true'));
  });

  it('lúc đang tải: đầu trang cùng khung h1 + đường dẫn "Hằng tháng › Báo cáo & gửi NCC" với lúc tải xong để tiêu đề không nhảy', async () => {
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

  it('đã gửi: đúng một dòng trạng thái "Đã gửi NCC 09:02 12/12" kèm "In lại"; không có "21 món, 143 đơn vị"', async () => {
    setupSendAdm({ report: REPORT, state: SENT });
    open();
    await screen.findByRole('spinbutton', { name: 'Đề nghị: Bút bi' });
    const status = statuses();
    expect(status).toHaveLength(1);
    expect(status[0]).toHaveTextContent('Đã gửi NCC 09:02 12/12');
    expect(within(status[0]!).getByRole('button', { name: 'In lại' })).toBeInTheDocument();
    expect(screen.queryByText(/\d+ món, \d+ đơn vị/)).toBeNull();
  });

  it('trạng thái nằm trên hàng tiêu đề, ngay trước nút Xuất Excel; không còn dòng "Không in kèm phụ lục" / hướng dẫn hộp in', async () => {
    setupSendAdm({ report: REPORT, state: SENT });
    open();
    await qtyBox('Bút bi');
    const status = statuses()[0]!;
    const head = screen.getByRole('heading', { level: 1, name: 'Báo cáo & gửi NCC' }).closest('.bc-head')!;
    expect(head).toContainElement(status);
    const excel = screen.getByRole('button', { name: 'Xuất Excel' });
    expect(status.compareDocumentPosition(excel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByText('Không in kèm phụ lục')).toBeNull();
    expect(screen.queryByText(/Trong hộp in/)).toBeNull();
  });

  it('có món đổi sau bản đã gửi → dòng trạng thái "có 1 món đổi sau bản này" và nhãn "Đổi sau bản in" ở đúng hàng', async () => {
    const changed = sendReport([PEN, itemRow({ key: 'kB', name: 'Giấy A4', requested: 4, need: 4 })]);
    setupSendAdm({ report: changed, state: sentState(sentData(REPORT, { kA: 5, kB: 3 })) });
    open();
    await screen.findByRole('spinbutton', { name: 'Đề nghị: Bút bi' });
    expect(statuses()[0]).toHaveTextContent('có 1 món đổi sau bản này');
    const rows = screen.getAllByRole('row');
    expect(within(rows.find((r) => r.textContent?.includes('Giấy A4'))!).getByText('Đổi sau bản in')).toBeInTheDocument();
    expect(within(rows.find((r) => r.textContent?.includes('Bút bi'))!).queryByText('Đổi sau bản in')).toBeNull();
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

  it('"In lại" là link nhỏ trong dòng trạng thái có icon SVG cạnh chữ', async () => {
    setupSendAdm({ report: REPORT, state: SENT });
    open();
    await qtyBox('Bút bi');
    const reprint = within(statuses()[0]!).getByRole('button', { name: 'In lại' });
    expect(reprint.querySelector('svg')).not.toBeNull();
  });
});

