import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, screen, userEvent, waitFor, within } from '@/test/test-utils';
import { renderApp } from '@/test/render-app';
import { makeMe } from '@/test/fixtures-me';
import { mockViewport } from '@/test/viewport';
import { itemRow, sendReport, sentData, sentState, setupSendAdm, YM } from '@/features/send-adm/send-adm-fixtures';
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

const statuses = () => within(screen.getByRole('main')).getAllByRole('status');

afterEach(() => vi.unstubAllGlobals());

describe('Báo cáo & gửi ADM: đầu trang và trạng thái', () => {
  it('một hàng đầu trang: h1, ‹ Tháng 10/2026 ›, công tắc "Chỉ món có Tổng cần", Xuất Excel, In trình ký', async () => {
    setupSendAdm({ report: REPORT });
    open();
    expect(await screen.findByRole('heading', { level: 1, name: 'Báo cáo & gửi ADM' })).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(await screen.findByText('Tháng 10/2026')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Chỉ món có Tổng cần' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Xuất Excel' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'In trình ký' })).toBeInTheDocument();
  });

  it('đã gửi: đúng một dòng trạng thái "Đã gửi ADM 09:02 12/12" kèm "In lại"; không có "21 món, 143 đơn vị"', async () => {
    setupSendAdm({ report: REPORT, state: SENT });
    open();
    await screen.findByRole('spinbutton', { name: 'Đề nghị: Bút bi' });
    const status = statuses();
    expect(status).toHaveLength(1);
    expect(status[0]).toHaveTextContent('Đã gửi ADM 09:02 12/12');
    expect(within(status[0]!).getByRole('button', { name: 'In lại' })).toBeInTheDocument();
    expect(screen.queryByText(/\d+ món, \d+ đơn vị/)).toBeNull();
  });

  it('trạng thái nằm trên hàng tiêu đề, ngay trước nút Xuất Excel; không còn dòng "Không in kèm phụ lục" / hướng dẫn hộp in', async () => {
    setupSendAdm({ report: REPORT, state: SENT });
    open();
    await qtyBox('Bút bi');
    const status = statuses()[0]!;
    const head = screen.getByRole('heading', { level: 1, name: 'Báo cáo & gửi ADM' }).parentElement!;
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

  it('chưa gửi: "Chưa gửi ADM"; có món ngoài DM chờ duyệt → thêm "2 món ngoài danh mục chờ duyệt · Xem"', async () => {
    setupSendAdm({ report: sendReport([PEN, PAPER], { pending_custom_count: 2 }) });
    open();
    await screen.findByText('Chưa gửi ADM');
    const status = statuses()[0]!;
    expect(status).toHaveTextContent('Chưa gửi ADM');
    expect(status).toHaveTextContent('2 món ngoài danh mục chờ duyệt');
    expect(within(status).getByRole('link', { name: 'Xem' })).toHaveAttribute('href', `/admin/review?status=pending&ym=${YM}`);
  });
});

describe('Báo cáo & gửi ADM: bảng và ô Đề nghị', () => {
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

  it('ô Đề nghị: 100000 → lỗi "Tối đa 99.999" gắn ô, Xuất Excel và In trình ký vô hiệu; 99999 hợp lệ → bật lại; biên 0 hợp lệ', async () => {
    setupSendAdm({ report: REPORT });
    open();
    const box = await qtyBox('Bút bi');
    await userEvent.clear(box);
    await userEvent.type(box, '100000');
    expect(await screen.findByText('Tối đa 99.999')).toBeInTheDocument();
    expect(box).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('button', { name: 'Xuất Excel' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'In trình ký' })).toBeDisabled();
    await userEvent.clear(box);
    await userEvent.type(box, '99999');
    expect(screen.queryByText('Tối đa 99.999')).toBeNull();
    expect(screen.getByRole('button', { name: 'In trình ký' })).toBeEnabled();
    await userEvent.clear(box);
    await userEvent.type(box, '0');
    expect(screen.queryByText('Tối đa 99.999')).toBeNull();
  });

  it('mọi Đề nghị = 0 và chưa gửi → nút "Tháng này không cần đề nghị ADM", Xuất/In vô hiệu', async () => {
    setupSendAdm({ report: REPORT });
    open();
    for (const name of ['Bút bi', 'Giấy A4']) {
      const box = await qtyBox(name);
      await userEvent.clear(box);
      await userEvent.type(box, '0');
    }
    expect(await screen.findByRole('button', { name: 'Tháng này không cần đề nghị ADM' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'In trình ký' })).toBeDisabled();
  });

  it('In trình ký gửi order_qty chỉ gồm ô đã sửa (số khác gợi ý) và reuse_if_unchanged', async () => {
    const f = setupSendAdm({ report: REPORT });
    open();
    const box = await qtyBox('Bút bi');
    await userEvent.clear(box);
    await userEvent.type(box, '7');
    await userEvent.click(screen.getByRole('button', { name: 'In trình ký' }));
    await waitFor(() => expect(f.mock.calls.some((c) => (c[1] as RequestInit | undefined)?.method === 'POST')).toBe(true));
    const post = f.mock.calls.find((c) => (c[1] as RequestInit | undefined)?.method === 'POST')!;
    expect(JSON.parse(String((post[1] as RequestInit).body))).toMatchObject({ kind: 'print', order_qty: { kA: 7 }, reuse_if_unchanged: true });
  });

  it('có món ngoài DM chờ duyệt → In trình ký hỏi lại (PrintConfirm) trước khi chốt', async () => {
    setupSendAdm({ report: sendReport([PEN, PAPER], { pending_custom_count: 2 }) });
    open();
    await qtyBox('Bút bi');
    await userEvent.click(screen.getByRole('button', { name: 'In trình ký' }));
    expect(await screen.findByRole('dialog', { name: 'Chốt phiếu gửi ADM?' })).toBeInTheDocument();
  });
});

describe('Báo cáo & gửi ADM: kỳ cũ hơn, ai đăng ký, các bản đã in', () => {
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
    expect(within(dialog).getByText('HC bỏ: Không có hàng')).toBeInTheDocument();
    expect(within(dialog).getByText('Tổng sau điều chỉnh')).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Xem phiếu của Nhân viên C' }));
    expect(await screen.findByRole('dialog', { name: 'Phiếu của Nhân viên C' })).toBeInTheDocument();
  });

  it('"Các bản đã in / xuất (2)" gập sẵn; mở ra: Lúc · Loại · Món · Đơn vị, "Đã gửi ADM" ở bản mới nhất có hàng, "Tải lại"', async () => {
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
    expect(within(newest!).getByText('Đã gửi ADM')).toBeInTheDocument();
    expect(within(oldest!).queryByText('Đã gửi ADM')).toBeNull();
    expect(within(oldest!).getByRole('button', { name: /Tải lại Excel/ })).toBeInTheDocument();
  });
});

describe('Báo cáo & gửi ADM: số khởi tạo từ bản đã gửi không bị coi là chưa chốt', () => {
  it('kỳ đã gửi với Đề nghị khác gợi ý: rời trang không hỏi; sửa thêm một ô thì hỏi "Bỏ số Đề nghị vừa sửa?"', async () => {
    setupSendAdm({ report: REPORT, state: sentState(sentData(REPORT, { kA: 9, kB: 3 })) });
    open();
    const box = await qtyBox('Bút bi');
    expect(box).toHaveValue(9);
    await userEvent.click(screen.getByRole('link', { name: 'Hàng về' }));
    expect(screen.queryByRole('dialog', { name: /Bỏ số Đề nghị vừa sửa/ })).toBeNull();
  });

  it('sửa một ô rồi bấm sang trang khác → hộp hỏi giữ số', async () => {
    setupSendAdm({ report: REPORT, state: sentState(sentData(REPORT, { kA: 9, kB: 3 })) });
    open();
    const box = await qtyBox('Bút bi');
    await userEvent.clear(box);
    await userEvent.type(box, '4');
    await userEvent.click(screen.getByRole('link', { name: 'Hàng về' }));
    expect(await screen.findByText('Bỏ số Đề nghị vừa sửa?')).toBeInTheDocument();
    // Hai ô khởi tạo từ bản đã gửi không tính: chỉ ô vừa gõ là thay đổi
    expect(screen.getByText(/Bạn đã sửa 1 món nhưng chưa In trình ký/)).toBeInTheDocument();
  });
});
