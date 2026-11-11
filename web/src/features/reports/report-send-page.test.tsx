import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, screen, userEvent, waitFor, within } from '@/test/test-utils';
import { renderApp } from '@/test/render-app';
import { makeMe } from '@/test/fixtures-me';
import { mockViewport } from '@/test/viewport';
import { callsTo, itemRow, sendReport, sentData, sentState, setupSendAdm, YM } from '@/features/send-adm/send-adm-fixtures';
import { errorResponse } from './reports-test-stub';
import { registrationView } from '@/features/summary/registration-fixtures';
import { snapshotRow } from './reports-fixtures';

const PEN = itemRow({ key: 'kA', name: 'Bút bi', requested: 5, need: 5 });
const PAPER = itemRow({ key: 'kB', name: 'Giấy A4', requested: 3, need: 3 });
const REPORT = sendReport([PEN, PAPER]);
// 09:02 12/12 giờ VN
const SENT = sentState(sentData(REPORT, { kA: 5, kB: 3 }));

function open(path = '/admin/reports') {
  mockViewport(1280);
  renderApp(makeMe('admin'), path);
}
const table = async () => within((await screen.findAllByRole('table'))[0]!);
const qtyBox = (name: string) => screen.findByRole('spinbutton', { name: `Đề nghị: ${name}` });

const snapshotPosts = (f: Parameters<typeof callsTo>[0]) => callsTo(f, 'POST', `/api/admin/reports/${YM}/snapshots`).filter((c) => c.url.endsWith('/snapshots'));

const statuses = () => within(screen.getByRole('main')).getAllByRole('status');

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
    expect(screen.getByRole('checkbox', { name: 'Chỉ món có Tổng cần' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Xuất Excel' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Xem tổng kết' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'In trình ký' })).toBeNull();
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
    const head = screen.getByRole('heading', { level: 1, name: 'Báo cáo & gửi NCC' }).parentElement!;
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

  it('chưa gửi: "Chưa gửi NCC"; có món ngoài DM chờ duyệt → thêm "2 món ngoài danh mục chờ duyệt · Xem"', async () => {
    setupSendAdm({ report: sendReport([PEN, PAPER], { pending_custom_count: 2 }) });
    open();
    await screen.findByText('Chưa gửi NCC');
    const status = statuses()[0]!;
    expect(status).toHaveTextContent('Chưa gửi NCC');
    expect(status).toHaveTextContent('2 món ngoài danh mục chờ duyệt');
    expect(within(status).getByRole('link', { name: 'Xem' })).toHaveAttribute('href', `/admin/review?status=pending&ym=${YM}`);
  });
});

describe('Báo cáo & gửi NCC: bảng và ô Đề nghị', () => {
  it('bảng kẻ ô: Món · ĐVT · Đăng ký · Nợ tháng trước · Tủ hiện có · Tổng cần · Đề nghị · Ai đăng ký; hàng nhóm "… · 2 món"; không còn Phần 2 hay Bản chốt', async () => {
    setupSendAdm({ report: REPORT, people: { kA: 3, kB: 1 } });
    open();
    const t = await table();
    await qtyBox('Bút bi');
    expect(t.getAllByRole('columnheader').map((h) => h.textContent?.replace(/Cách tính Tổng cần/, ''))).toEqual(['Món', 'ĐVT', 'Đăng ký', 'Nợ tháng trước', 'Tủ hiện có (tham khảo)', 'Tổng cần', 'Đề nghị', 'Ai đăng ký']);
    expect(t.getByText('2 món')).toBeInTheDocument();
    expect(screen.queryByText(/Phần 2/)).toBeNull();
    expect(screen.queryByText('Bản chốt')).toBeNull();
    expect(screen.queryByText(/Xuất lẻ/)).toBeNull();
  });

  it('ô Đề nghị: 100000 → lỗi "Tối đa 99.999" gắn ô, Xuất Excel và Xem tổng kết vô hiệu; 99999 hợp lệ → bật lại; biên 0 hợp lệ', async () => {
    setupSendAdm({ report: REPORT });
    open();
    const box = await qtyBox('Bút bi');
    await userEvent.clear(box);
    await userEvent.type(box, '100000');
    expect(await screen.findByText('Tối đa 99.999')).toBeInTheDocument();
    expect(box).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('button', { name: 'Xuất Excel' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Xem tổng kết' })).toBeDisabled();
    await userEvent.clear(box);
    await userEvent.type(box, '99999');
    expect(screen.queryByText('Tối đa 99.999')).toBeNull();
    expect(screen.getByRole('button', { name: 'Xem tổng kết' })).toBeEnabled();
    await userEvent.clear(box);
    await userEvent.type(box, '0');
    expect(screen.queryByText('Tối đa 99.999')).toBeNull();
  });

  it('mọi Đề nghị = 0 và chưa gửi → nút "Tháng này không cần đề nghị NCC", Xuất/In vô hiệu', async () => {
    setupSendAdm({ report: REPORT });
    open();
    for (const name of ['Bút bi', 'Giấy A4']) {
      const box = await qtyBox(name);
      await userEvent.clear(box);
      await userEvent.type(box, '0');
    }
    expect(await screen.findByRole('button', { name: 'Tháng này không cần đề nghị NCC' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Xem tổng kết' })).toBeDisabled();
  });

  it('Xem tổng kết → gọi preview với ô đã sửa, hộp có "Phiếu đề xuất văn phòng phẩm" và các hàng; chưa POST bản chốt', async () => {
    const f = setupSendAdm({ report: REPORT });
    open();
    const box = await qtyBox('Bút bi');
    await userEvent.clear(box);
    await userEvent.type(box, '7');
    await userEvent.click(screen.getByRole('button', { name: 'Xem tổng kết' }));
    const dialog = await screen.findByRole('dialog', { name: 'Xem tổng kết tháng 10/2026' });
    expect(callsTo(f, 'POST', '/snapshots/preview')).toEqual([{ url: `/api/admin/reports/${YM}/snapshots/preview`, body: { order_qty: { kA: 7 } } }]);
    expect(within(dialog).getByText('2 món · 10 đơn vị. Kiểm tra lại trước khi in trình ký.')).toBeInTheDocument();
    expect(within(dialog).getByRole('heading', { name: 'Phiếu đề xuất văn phòng phẩm' })).toBeInTheDocument();
    const rows = within(within(dialog).getByRole('table')).getAllByRole('row');
    expect(rows.some((r) => r.textContent?.includes('Bút bi') && r.textContent.endsWith('7'))).toBe(true);
    expect(rows.some((r) => r.textContent?.includes('Giấy A4'))).toBe(true);
    expect(within(dialog).getByText(/Bấm Hủy thì không lưu bản nào/)).toBeInTheDocument();
    expect(snapshotPosts(f)).toEqual([]);
  });

  it('Hủy → đóng hộp, không POST bản chốt, không mở hộp in, danh sách bản in không đổi', async () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => undefined);
    const f = setupSendAdm({ report: REPORT });
    open();
    await qtyBox('Bút bi');
    await userEvent.click(screen.getByRole('button', { name: 'Xem tổng kết' }));
    const dialog = await screen.findByRole('dialog', { name: /Xem tổng kết tháng/ });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Hủy' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(snapshotPosts(f)).toEqual([]);
    expect(print).not.toHaveBeenCalled();
    expect(await screen.findByText('Các bản đã in / xuất (0)')).toBeInTheDocument();
  });

  it('Đồng ý và in → POST bản chốt kind print (ô đã sửa + reuse_if_unchanged) rồi mở hộp in', async () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => undefined);
    const f = setupSendAdm({ report: REPORT });
    open();
    const box = await qtyBox('Bút bi');
    await userEvent.clear(box);
    await userEvent.type(box, '7');
    await userEvent.click(screen.getByRole('button', { name: 'Xem tổng kết' }));
    const dialog = await screen.findByRole('dialog', { name: /Xem tổng kết tháng/ });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Đồng ý và in' }));
    await waitFor(() => expect(snapshotPosts(f)).toHaveLength(1));
    expect(snapshotPosts(f)[0]!.body).toMatchObject({ kind: 'print', order_qty: { kA: 7 }, reuse_if_unchanged: true });
    await waitFor(() => expect(print).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('dialog', { name: /Xem tổng kết tháng/ })).toBeNull();
  });

  it('có món ngoài DM chờ duyệt → cảnh báo W8 nằm trong hộp xem trước, không bật hộp "Chốt phiếu gửi NCC?" riêng', async () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => undefined);
    const f = setupSendAdm({ report: sendReport([PEN, PAPER], { pending_custom_count: 2 }) });
    open();
    await qtyBox('Bút bi');
    await userEvent.click(screen.getByRole('button', { name: 'Xem tổng kết' }));
    const dialog = await screen.findByRole('dialog', { name: /Xem tổng kết tháng/ });
    expect(within(dialog).getByText(/2 món ngoài danh mục/)).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Chốt phiếu gửi NCC?' })).toBeNull();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Đồng ý và in' }));
    await waitFor(() => expect(snapshotPosts(f)).toHaveLength(1));
    expect(screen.queryByRole('dialog', { name: 'Chốt phiếu gửi NCC?' })).toBeNull();
    await waitFor(() => expect(print).toHaveBeenCalled());
  });

  it('Xem tổng kết lỗi ORDER_EMPTY → báo ở đầu trang, không mở hộp', async () => {
    setupSendAdm({ report: REPORT, stub: { preview: () => errorResponse(409, 'ORDER_EMPTY') } });
    open();
    await qtyBox('Bút bi');
    await userEvent.click(screen.getByRole('button', { name: 'Xem tổng kết' }));
    expect(await screen.findByText('Chưa có món nào để đề nghị.')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('Xuất Excel khi có món ngoài DM chờ duyệt vẫn hỏi lại (PrintConfirm) trước khi chốt', async () => {
    setupSendAdm({ report: sendReport([PEN, PAPER], { pending_custom_count: 2 }) });
    open();
    await qtyBox('Bút bi');
    await userEvent.click(screen.getByRole('button', { name: 'Xuất Excel' }));
    expect(await screen.findByRole('dialog', { name: 'Chốt phiếu gửi NCC?' })).toBeInTheDocument();
  });
});

describe('Báo cáo & gửi NCC: kỳ cũ hơn, ai đăng ký, các bản đã in', () => {
  it('kỳ cũ hơn: Đề nghị chỉ đọc, lấy order_qty của bản đã gửi', async () => {
    const older = sendReport([PEN, PAPER], { ym: '2026-09' });
    const oldSent = sentState(sentData(older, { kA: 9, kB: 4 }, { period_ym: '2026-09' }));
    setupSendAdm({
      report: REPORT,
      extra: (url) => {
        if (url === '/api/admin/reports/2026-09') return jsonResponse(200, older);
        if (url === '/api/admin/periods/2026-09/send-state') return jsonResponse(200, oldSent);
        if (url === '/api/admin/periods/2026-09/summary') return jsonResponse(200, { ym: '2026-09', deadline: '2026-09-10T17:00:00Z', is_open: false, registered: 3, headcount: 3, unregistered: 0, custom_pending: 0, lines_pending_delivery: 0 });
        if (url.startsWith('/api/admin/periods/2026-09/requests?by=item')) return jsonResponse(200, { items: [] });
        if (url.startsWith('/api/admin/reports/2026-09/snapshots')) return jsonResponse(200, { items: [] });
        return undefined;
      },
    });
    open('/admin/reports?ym=2026-09');
    const t = await table();
    await waitFor(() => expect(t.getAllByRole('row').some((r) => r.textContent?.includes('Bút bi'))).toBe(true));
    expect(screen.queryByRole('spinbutton')).toBeNull();
    const pen = t.getAllByRole('row').find((r) => r.textContent?.includes('Bút bi'))!;
    expect(within(pen).getAllByRole('cell').some((c) => c.textContent === '9')).toBe(true);
  });

  it('kỳ cũ hơn: Xem tổng kết mở hộp với bản đã gửi (không gọi preview), nút "In" in thẳng bản đó, không tạo bản', async () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => undefined);
    const older = sendReport([PEN, PAPER], { ym: '2026-09' });
    const oldSent = sentState(sentData(older, { kA: 9, kB: 4 }, { period_ym: '2026-09' }));
    const f = setupSendAdm({
      report: REPORT,
      extra: (url) => {
        if (url === '/api/admin/reports/2026-09') return jsonResponse(200, older);
        if (url === '/api/admin/periods/2026-09/send-state') return jsonResponse(200, oldSent);
        if (url === '/api/admin/periods/2026-09/summary') return jsonResponse(200, { ym: '2026-09', deadline: '2026-09-10T17:00:00Z', is_open: false, registered: 3, headcount: 3, unregistered: 0, custom_pending: 0, lines_pending_delivery: 0 });
        if (url.startsWith('/api/admin/periods/2026-09/requests?by=item')) return jsonResponse(200, { items: [] });
        if (url.startsWith('/api/admin/reports/2026-09/snapshots')) return jsonResponse(200, { items: [] });
        return undefined;
      },
    });
    open('/admin/reports?ym=2026-09');
    await table();
    const btn = await screen.findByRole('button', { name: 'Xem tổng kết' });
    await waitFor(() => expect(btn).toBeEnabled());
    await userEvent.click(btn);
    const dialog = await screen.findByRole('dialog', { name: 'Xem tổng kết tháng 9/2026' });
    expect(within(dialog).queryByRole('button', { name: 'Đồng ý và in' })).toBeNull();
    await userEvent.click(within(dialog).getByRole('button', { name: 'In' }));
    await waitFor(() => expect(print).toHaveBeenCalledTimes(1));
    expect(f.mock.calls.filter((c) => (c[1] as RequestInit | undefined)?.method === 'POST')).toEqual([]);
  });

  it('"3 người" → popup "Ai đăng ký món" (Đăng ký 20 · sau điều chỉnh 19 · Đề nghị) → "Xem phiếu" mở popup phiếu', async () => {
    const people = {
      key: 'kA',
      name: 'Bút bi',
      unit: 'cay',
      requested: 20,
      after: 19,
      people: [
        { request_id: 'q-a', user_sub: 'u-a', full_name: 'Nhân viên C', email: null, team: 'Team Test', qty: 19, before: null, reason_code: null, reason_note: null },
        { request_id: 'q-b', user_sub: 'u-b', full_name: 'Nhân viên B', email: null, team: 'Team Test', qty: 0, before: 1, reason_code: 'adm_out_of_stock', reason_note: null },
      ],
    };
    setupSendAdm({
      report: REPORT,
      people: { kA: 3 },
      extra: (url) => {
        if (url === `/api/admin/periods/${YM}/items/kA/people`) return jsonResponse(200, people);
        if (url === `/api/admin/periods/${YM}/registrations/q-a`) return jsonResponse(200, { ...registrationView('q-a'), period_ym: YM });
        return undefined;
      },
    });
    open();
    await userEvent.click(await screen.findByRole('button', { name: /Xem ai đăng ký Bút bi \(3 người\)/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Bút bi' });
    expect(await within(dialog).findByText('Đăng ký 20 cây · sau điều chỉnh 19 · Đề nghị 5')).toBeInTheDocument();
    expect(within(dialog).getByText('Adm D&E bỏ: Không có hàng')).toBeInTheDocument();
    expect(within(dialog).getByText('Tổng sau điều chỉnh')).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Xem phiếu của Nhân viên C' }));
    expect(await screen.findByRole('dialog', { name: 'Phiếu của Nhân viên C' })).toBeInTheDocument();
  });

  it('"Các bản đã in / xuất (2)" gập sẵn; mở ra: Lúc · Loại · Món · Đơn vị, "Đã gửi NCC" ở bản mới nhất có hàng, "Tải lại"', async () => {
    const rows = [
      snapshotRow({ id: 's-new', kind: 'print', created_at: '2026-10-28T04:50:00Z', items_count: 21, units_total: 143, has_items: true }),
      snapshotRow({ id: 's-old', kind: 'xlsx', created_at: '2026-10-28T03:12:00Z', items_count: 21, units_total: 141, has_items: true }),
    ];
    setupSendAdm({ report: REPORT, snapshots: rows });
    open();
    const summary = await screen.findByText('Các bản đã in / xuất (2)');
    const box = summary.closest('details')!;
    expect(box).not.toHaveAttribute('open');
    expect(screen.queryByText(/Mỗi lần In hay Xuất Excel/)).not.toBeVisible();
    await userEvent.click(summary);
    expect(box).toHaveAttribute('open');
    const t = within(within(box).getByRole('table'));
    expect(t.getAllByRole('columnheader').map((h) => h.textContent).slice(0, 4)).toEqual(['Lúc', 'Loại', 'Món', 'Đơn vị']);
    const [newest, oldest] = t.getAllByRole('row').slice(1);
    expect(within(newest!).getByText('Đã gửi NCC')).toBeInTheDocument();
    expect(within(oldest!).queryByText('Đã gửi NCC')).toBeNull();
    expect(within(oldest!).getByRole('button', { name: /Tải lại Excel/ })).toBeInTheDocument();
  });
});

describe('Báo cáo & gửi NCC: số khởi tạo từ bản đã gửi không bị coi là chưa chốt', () => {
  it('kỳ đã gửi với Đề nghị khác gợi ý: rời trang không hỏi; sửa thêm một ô thì hỏi "Bỏ số Đề nghị vừa sửa?"', async () => {
    setupSendAdm({ report: REPORT, state: sentState(sentData(REPORT, { kA: 9, kB: 3 })) });
    open();
    const box = await qtyBox('Bút bi');
    expect(box).toHaveValue(9);
    await userEvent.click(screen.getByRole('link', { name: 'Nhận hàng' }));
    expect(screen.queryByRole('dialog', { name: /Bỏ số Đề nghị vừa sửa/ })).toBeNull();
  });

  it('sửa một ô rồi bấm sang trang khác → hộp hỏi giữ số', async () => {
    setupSendAdm({ report: REPORT, state: sentState(sentData(REPORT, { kA: 9, kB: 3 })) });
    open();
    const box = await qtyBox('Bút bi');
    await userEvent.clear(box);
    await userEvent.type(box, '4');
    await userEvent.click(screen.getByRole('link', { name: 'Nhận hàng' }));
    expect(await screen.findByText('Bỏ số Đề nghị vừa sửa?')).toBeInTheDocument();
    // Hai ô khởi tạo từ bản đã gửi không tính: chỉ ô vừa gõ là thay đổi
    expect(screen.getByText(/Bạn đã sửa 1 món nhưng chưa Xem tổng kết và bấm Đồng ý và in/)).toBeInTheDocument();
  });
});
