import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, screen, userEvent, waitFor, within } from '@/test/test-utils';
import { renderApp } from '@/test/render-app';
import { makeMe } from '@/test/fixtures-me';
import { mockViewport } from '@/test/viewport';
import { callsTo, itemRow, SENT_AT, sendReport, sentData, sentState, setupSendAdm, UNSENT, YM } from './send-adm-fixtures';

const PEN = itemRow({ key: 'kA', name: 'Bút bi', requested: 5, stock: 0 });
const PAPER = itemRow({ key: 'kB', name: 'Giấy A4', requested: 3, stock: 0, unit: 'ream' });

async function open() {
  mockViewport(1280);
  renderApp(makeMe('admin'), '/admin/send-adm');
  await screen.findByRole('heading', { level: 1, name: 'Gửi ADM, kỳ tháng 10' });
}

const table = () => screen.findByRole('table', { name: /theo món$/ });
const rowOf = async (name: string) => within(await table()).getByRole('row', { name: new RegExp(name) });
const cellUnder = (row: HTMLElement, header: string) => {
  const heads = within(screen.getByRole('table', { name: /theo món$/ })).getAllByRole('columnheader').map((h) => h.textContent);
  return within(row).getAllByRole('cell')[heads.indexOf(header)];
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Gửi ADM — chế độ Đã gửi', () => {
  // Báo cáo sống đã đổi (cần 5) nhưng bảng phải theo bản: Bút bi 7 (đã sửa tay), Giấy A4 3
  const snap = sentData(sendReport([{ ...PEN, requested: 5 }, PAPER]), { kA: 7, kB: 3 });

  it('có bản → mở Đã gửi: băng xanh, bảng chỉ đọc theo order_qty của bản, không ô nhập, không nút In trình ký', async () => {
    setupSendAdm({ report: sendReport([{ ...PEN, requested: 9 }, PAPER]), state: sentState(snap) });
    await open();
    expect(await screen.findByText('Đã gửi ADM lúc 09:02 12/12 · 2 món, 10 đơn vị')).toBeInTheDocument();
    expect(await rowOf('Bút bi')).toHaveTextContent('7');
    expect(screen.queryByRole('spinbutton')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Sửa số' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'In trình ký' })).toBeNull();
  });

  it('"In lại bản này" mở trang in của bản, 0 POST; "Xuất Excel bản này" tải đúng bản, 0 POST', async () => {
    const f = setupSendAdm({ report: sendReport([PEN, PAPER]), state: sentState(snap) });
    await open();
    await userEvent.click(await screen.findByRole('button', { name: 'Xuất Excel bản này' }));
    await waitFor(() => expect(callsTo(f, 'GET', '/snapshots/snap-old/export.xlsx')).toHaveLength(1));
    await userEvent.click(screen.getByRole('button', { name: 'In lại bản này' }));
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/admin/reports/snapshots/snap-old/print'));
    expect(screen.getByTestId('location-search')).toHaveTextContent('?from=send-adm');
    expect(callsTo(f, 'POST', '/api/')).toHaveLength(0);
  });

  it('băng thay thế: "(thay thế bản 09:02 12/12)" khi bản có replaces', async () => {
    const replacing = sentData(sendReport([PEN]), { kA: 5 }, { id: 'snap-2', created_at: '2026-12-12T03:30:00.000Z', replaces: { id: 'snap-old', created_at: SENT_AT } });
    setupSendAdm({ report: sendReport([PEN]), state: sentState(replacing) });
    await open();
    expect(await screen.findByText('Đã gửi ADM lúc 10:30 12/12 · 1 món, 5 đơn vị (thay thế bản 09:02 12/12)')).toBeInTheDocument();
  });

  it('W6: có thay đổi sau bản → băng "Có thay đổi sau bản chốt 09:02 12/12 — in lại nếu cần"; không có → không băng', async () => {
    setupSendAdm({ report: sendReport([PEN, PAPER]), state: sentState(snap, { changed_after: true, changed_at: '2026-12-12T05:00:00Z' }) });
    await open();
    expect(await screen.findByText('Có thay đổi sau bản chốt 09:02 12/12 — in lại nếu cần')).toBeInTheDocument();
  });

  it('W7: bản gửi 7, lúc chốt cần 7, nay cần 5 → "Bản gửi 7 · nay cần 5 → dư 2 vào kho"; hàng không đổi cần → không W7', async () => {
    const basis = sentData(sendReport([{ ...PEN, requested: 7 }, PAPER]), { kA: 7, kB: 3 });
    setupSendAdm({ report: sendReport([{ ...PEN, requested: 5 }, PAPER]), state: sentState(basis, { changed_after: true }) });
    await open();
    expect(await rowOf('Bút bi')).toHaveTextContent('Bản gửi 7 · nay cần 5 → dư 2 vào kho');
    expect(await rowOf('Giấy A4')).not.toHaveTextContent('Bản gửi');
  });

  it('W7 sau giao một phần: bản gửi 7 (cần 7), sau đó giao 5 → nay cần 2 chưa giao + 5 đã giao = 7 → không W7', async () => {
    const basis = sentData(sendReport([{ ...PEN, requested: 7 }]), { kA: 7 });
    setupSendAdm({ report: sendReport([{ ...PEN, requested: 2 }]), state: sentState(basis, { delivered_since: { kA: 5 } }) });
    await open();
    expect(await rowOf('Bút bi')).toHaveTextContent('7');
    expect(await rowOf('Bút bi')).not.toHaveTextContent('Bản gửi');
  });

  it('W7 sau giao + giảm: bản gửi 7, giao 3 rồi giảm 2 → "Bản gửi 7 · nay cần 5 → dư 2 vào kho"', async () => {
    const basis = sentData(sendReport([{ ...PEN, requested: 7 }]), { kA: 7 });
    setupSendAdm({ report: sendReport([{ ...PEN, requested: 2 }]), state: sentState(basis, { changed_after: true, delivered_since: { kA: 3 } }) });
    await open();
    expect(await rowOf('Bút bi')).toHaveTextContent('Bản gửi 7 · nay cần 5 → dư 2 vào kho');
  });

  it('W7 thiếu: bản gửi 3, nay cần 5 → "→ thiếu 2"; không có W1 ở chế độ này', async () => {
    const basis = sentData(sendReport([{ ...PEN, requested: 3 }]), { kA: 3 });
    setupSendAdm({ report: sendReport([{ ...PEN, requested: 5 }]), state: sentState(basis) });
    await open();
    expect(await rowOf('Bút bi')).toHaveTextContent('Bản gửi 3 · nay cần 5 → thiếu 2');
    expect(screen.queryByText('Đủ cho người đăng ký')).toBeNull();
  });
});

describe('Gửi ADM — Làm bản mới', () => {
  // Bản trước: Bút bi sửa tay 7 (gợi ý lúc đó 5), Giấy A4 để gợi ý 3
  const snap = sentData(sendReport([PEN, PAPER]), { kA: 7, kB: 3 });

  it('"Làm bản mới" → hộp chữ mới; Quay lại → vẫn Đã gửi; xác nhận → Lập phiếu, ô đã sửa mang sang có nhãn cam', async () => {
    setupSendAdm({ report: sendReport([PEN, PAPER]), state: sentState(snap) });
    await open();
    await userEvent.click(await screen.findByRole('button', { name: 'Làm bản mới' }));
    let dialog = await screen.findByRole('dialog', { name: 'Làm bản mới?' });
    expect(dialog).toHaveTextContent('Bản mới sẽ thay thế toàn bộ bản in lúc 09:02 12/12 — tờ in ghi rõ để ADM bỏ bản cũ. Hàng về và nút "Đủ hàng" sẽ theo bản mới.');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Quay lại' }));
    expect(screen.getByRole('button', { name: 'In lại bản này' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Làm bản mới' }));
    dialog = await screen.findByRole('dialog', { name: 'Làm bản mới?' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Làm bản mới' }));
    expect(await screen.findByRole('button', { name: 'In trình ký' })).toBeInTheDocument();
    expect(await rowOf('Bút bi')).toHaveTextContent('Đã sửa: 7 (gợi ý 5)');
    expect(await rowOf('Giấy A4')).not.toHaveTextContent('Đã sửa');
  });

  it('In trình ký ở bản mới gửi reuse_if_unchanged và số đã sửa; xong → về Đã gửi', async () => {
    const f = setupSendAdm({ report: sendReport([PEN, PAPER]), state: sentState(snap), afterPost: sentState(snap) });
    await open();
    await userEvent.click(await screen.findByRole('button', { name: 'Làm bản mới' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Làm bản mới' }));
    await userEvent.click(await screen.findByRole('button', { name: 'In trình ký' }));
    await waitFor(() => expect(callsTo(f, 'POST', '/snapshots')).toHaveLength(1));
    expect(callsTo(f, 'POST', '/snapshots')[0].body).toEqual({ kind: 'print', order_qty: { kA: 7 }, reuse_if_unchanged: true });
    expect(await screen.findByRole('button', { name: 'In lại bản này' })).toBeInTheDocument();
  });

  it('bản mới khác số → hộp in liệt kê "Đổi so với bản 09:02 12/12: Bút bi 7 → 5"; Quay lại → 0 POST', async () => {
    const f = setupSendAdm({ report: sendReport([PEN, PAPER]), state: sentState(snap) });
    await open();
    await userEvent.click(await screen.findByRole('button', { name: 'Làm bản mới' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Làm bản mới' }));
    const pen = await rowOf('Bút bi');
    await userEvent.click(within(pen).getByRole('button', { name: 'Về số gợi ý' }));
    await userEvent.click(screen.getByRole('button', { name: 'In trình ký' }));
    const dialog = await screen.findByRole('dialog', { name: 'Bản mới thay thế bản in lúc 09:02 12/12' });
    expect(dialog).toHaveTextContent('Đổi so với bản 09:02 12/12:');
    expect(within(dialog).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Bút bi 7 → 5']);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Quay lại' }));
    expect(callsTo(f, 'POST', '/snapshots')).toHaveLength(0);
  });

  it('12 món đổi số → hộp in hiện 10 dòng + "và 2 món khác"', async () => {
    const rows = Array.from({ length: 12 }, (_, i) => itemRow({ key: `k${i}`, name: `Món ${i + 1}`, requested: 2 }));
    const old = sentData(sendReport(rows), Object.fromEntries(rows.map((r) => [r.key, 4])));
    setupSendAdm({ report: sendReport(rows), state: sentState(old) });
    await open();
    await userEvent.click(await screen.findByRole('button', { name: 'Làm bản mới' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Làm bản mới' }));
    // Mọi ô mang sang 4 (đã sửa); bỏ hết về gợi ý 2
    for (const btn of await screen.findAllByRole('button', { name: 'Về số gợi ý' })) await userEvent.click(btn);
    await userEvent.click(screen.getByRole('button', { name: 'Xuất Excel mẫu phòng' }));
    const dialog = await screen.findByRole('dialog', { name: /Bản mới thay thế/ });
    expect(within(dialog).getAllByRole('listitem')).toHaveLength(10);
    expect(dialog).toHaveTextContent('và 2 món khác');
  });

  it('bản mới tổng 0 → không có nút "Tháng này không cần đề nghị ADM", In vô hiệu với lý do', async () => {
    setupSendAdm({ report: sendReport([{ ...PEN, requested: 0 }]), state: sentState(sentData(sendReport([PEN]), { kA: 5 })) });
    await open();
    await userEvent.click(await screen.findByRole('button', { name: 'Làm bản mới' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Làm bản mới' }));
    expect(await screen.findByRole('button', { name: 'In trình ký' })).toBeDisabled();
    expect(screen.getByText('Chưa có món nào để đề nghị')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Tháng này không cần đề nghị ADM' })).toBeNull();
  });

  it('sửa 1 ô rồi "Quay lại" → hộp R-D5.17; "Ở lại" giữ số; "Bỏ thay đổi" về Đã gửi', async () => {
    setupSendAdm({ report: sendReport([PEN, PAPER]), state: sentState(sentData(sendReport([PEN, PAPER]), { kA: 5, kB: 3 })) });
    await open();
    await userEvent.click(await screen.findByRole('button', { name: 'Làm bản mới' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Làm bản mới' }));
    const pen = await rowOf('Bút bi');
    await userEvent.click(within(pen).getByRole('button', { name: 'Sửa số' }));
    const box = within(pen).getByRole('spinbutton');
    await userEvent.clear(box);
    await userEvent.type(box, '9');
    await userEvent.click(screen.getByRole('button', { name: 'Quay lại' }));
    let dialog = await screen.findByRole('dialog', { name: 'Bỏ số Đề nghị vừa sửa?' });
    expect(dialog).toHaveTextContent('Bạn đã sửa 1 món nhưng chưa In trình ký. Rời trang sẽ mất các số này.');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Ở lại' }));
    expect(within(await rowOf('Bút bi')).getByRole('spinbutton')).toHaveValue(9);
    await userEvent.click(screen.getByRole('button', { name: 'Quay lại' }));
    dialog = await screen.findByRole('dialog', { name: 'Bỏ số Đề nghị vừa sửa?' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Bỏ thay đổi' }));
    expect(await screen.findByRole('button', { name: 'In lại bản này' })).toBeInTheDocument();
  });
});

describe('Gửi ADM — Lập phiếu (chưa gửi)', () => {
  it('tổng 0 chưa có bản → nút "Tháng này không cần đề nghị ADM" + hộp → POST no-order → băng Không cần đề nghị', async () => {
    const f = setupSendAdm({ report: sendReport([{ ...PEN, requested: 0 }]), state: UNSENT });
    await open();
    expect(await screen.findByRole('button', { name: 'In trình ký' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Tháng này không cần đề nghị ADM' }));
    const dialog = await screen.findByRole('dialog', { name: 'Tháng này không cần đề nghị ADM?' });
    expect(dialog).toHaveTextContent('Tủ đã đủ cho mọi người đăng ký. Bước Gửi ADM và Hàng về sẽ tính là xong; cần thì vẫn lập phiếu lại được.');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Xác nhận' }));
    await waitFor(() => expect(callsTo(f, 'POST', '/no-order')).toEqual([{ url: `/api/admin/periods/${YM}/no-order`, body: { order_qty: {} } }]));
    expect(await screen.findByText('Tháng này không cần đề nghị ADM (09:02 12/12, An)')).toBeInTheDocument();
  });

  it.each([
    ['ORDER_NOT_EMPTY', 'Tổng đề nghị ở máy chủ đã lớn hơn 0 — tải lại trang rồi lập phiếu.'],
    ['ALREADY_SENT', 'Kỳ này đã có bản gửi ADM — tải lại trang để xem.'],
  ])('no-order trả 409 %s → báo đúng lý do, không phải "Chưa lưu được"', async (code, text) => {
    const f = setupSendAdm({ report: sendReport([{ ...PEN, requested: 0 }]), state: UNSENT });
    const base = f.getMockImplementation()!;
    f.mockImplementation((url: string, init?: RequestInit) => (url.endsWith('/no-order') && init?.method === 'POST' ? Promise.resolve(jsonResponse(409, { code })) : base(url, init)));
    await open();
    await userEvent.click(await screen.findByRole('button', { name: 'Tháng này không cần đề nghị ADM' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Xác nhận' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(text);
    expect(screen.queryByText('Chưa lưu được, thử lại sau.')).toBeNull();
  });

  it('Không cần đề nghị → "Lập phiếu" xóa cờ (DELETE) và về Lập phiếu', async () => {
    const f = setupSendAdm({ report: sendReport([{ ...PEN, requested: 0 }]), state: { ...UNSENT, state: 'no_order', no_order_at: SENT_AT, no_order_by_name: 'An' } });
    await open();
    await userEvent.click(await screen.findByRole('button', { name: 'Lập phiếu' }));
    await waitFor(() => expect(callsTo(f, 'DELETE', '/no-order')).toHaveLength(1));
    expect(await screen.findByRole('button', { name: 'In trình ký' })).toBeInTheDocument();
  });

  it('cột Đăng ký 5 / Đã giao 2 / công thức dùng 3 chưa giao', async () => {
    setupSendAdm({ report: sendReport([{ ...PEN, requested: 3 }], { progress: { kA: { registered: 5, delivered: 2, received: 0 } } }) });
    await open();
    const row = await rowOf('Bút bi');
    expect(cellUnder(row, 'Đăng ký')).toHaveTextContent(/^5$/);
    expect(cellUnder(row, 'Đã giao')).toHaveTextContent(/^2$/);
    expect(row).toHaveTextContent('= 3 đăng ký chưa giao + 0 nợ');
    expect(screen.getByRole('columnheader', { name: 'Tổng cần' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Tủ hiện có (tham khảo)' })).toBeInTheDocument();
  });

  it('không món nào đã giao → không có cột Đã giao', async () => {
    setupSendAdm({ report: sendReport([PEN], { progress: { kA: { registered: 5, delivered: 0, received: 0 } } }) });
    await open();
    await table();
    expect(screen.queryByRole('columnheader', { name: 'Đã giao' })).toBeNull();
  });

  it('W2 đếm thiếu/dư/đủ ở đầu bảng; lọc "Thiếu" chỉ còn hàng thiếu', async () => {
    setupSendAdm({ report: sendReport([PEN, PAPER, itemRow({ key: 'kC', name: 'Kẹp giấy', requested: 2, stock: 4 })]) });
    await open();
    const pen = await rowOf('Bút bi');
    await userEvent.click(within(pen).getByRole('button', { name: 'Sửa số' }));
    await userEvent.clear(within(pen).getByRole('spinbutton'));
    await userEvent.type(within(pen).getByRole('spinbutton'), '4');
    expect(screen.getByText('1 món thiếu · 1 món dư vào kho · 1 món đủ')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: /^Thiếu/ }));
    const rows = within(await table()).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveTextContent('Bút bi');
  });

  it('W8: còn món ngoài danh mục chờ xem → hộp In có khối W8 và link xem món; "In trình ký" trong hộp mới POST', async () => {
    const f = setupSendAdm({ report: sendReport([PEN], { pending_custom_count: 2 }) });
    await open();
    await userEvent.click(await screen.findByRole('button', { name: 'In trình ký' }));
    const dialog = await screen.findByRole('dialog', { name: 'Chốt phiếu gửi ADM?' });
    expect(dialog).toHaveTextContent('Còn 2 món ngoài danh mục chưa xem; chốt vẫn thiếu các món này.');
    expect(within(dialog).getByRole('link', { name: 'Xem món ngoài danh mục' })).toHaveAttribute('href', `/admin/review?status=pending&ym=${YM}`);
    expect(callsTo(f, 'POST', '/snapshots')).toHaveLength(0);
    await userEvent.click(within(dialog).getByRole('button', { name: 'In trình ký' }));
    await waitFor(() => expect(callsTo(f, 'POST', '/snapshots')).toHaveLength(1));
  });

  it('món ngừng: nhãn "Ngừng dùng" + W3, gợi ý 0', async () => {
    setupSendAdm({ report: sendReport([PEN, itemRow({ key: 'kOff', name: 'Món ngừng', requested: 3, usable: false })]) });
    await open();
    const row = await rowOf('Món ngừng');
    expect(row).toHaveTextContent('Ngừng dùng');
    expect(row).toHaveTextContent('Món đã ngừng — đề nghị mặc định 0; muốn mua thì sửa số');
    expect(within(cellUnder(row, 'Đề nghị')).getByText('0').tagName).toBe('B');
  });

  it('dòng xám có tháng ADM còn nợ lấy từ kế hoạch Hàng về', async () => {
    setupSendAdm({ report: sendReport([{ ...PEN, requested: 8, backlog_prev: 2, adm_owed: 1, left_excluded: 3 }]), makeup: [{ ym: '2026-09', rows: [{ key: 'kA', adm_owed: 1 }] }] });
    await open();
    expect(await screen.findByText('= 8 đăng ký + 2 nợ − 1 ADM còn nợ giao (tháng 9) · không tính 3 của người đã nghỉ')).toBeInTheDocument();
  });

  it('"Xem trước bản in" mở hộp có tờ phiếu A4', async () => {
    setupSendAdm({ report: sendReport([PEN]) });
    await open();
    expect(screen.queryByRole('region', { name: /Xem trước phiếu A4/ })).toBeNull();
    await userEvent.click(await screen.findByRole('button', { name: 'Xem trước bản in' }));
    const dialog = await screen.findByRole('dialog', { name: 'Xem trước bản in' });
    expect(within(dialog).getByRole('region', { name: /Xem trước phiếu A4/ })).toHaveTextContent('Bút bi');
  });

  it('"Xem trước bản in" giữ hàng Đề nghị 0 như tờ in: Bút bi 5, Giấy A4 sửa 0 → 2 hàng, Giấy A4 SL 0', async () => {
    setupSendAdm({ report: sendReport([PEN, PAPER]) });
    await open();
    const paper = await rowOf('Giấy A4');
    await userEvent.click(within(paper).getByRole('button', { name: 'Sửa số' }));
    const box = within(await rowOf('Giấy A4')).getByRole('spinbutton');
    await userEvent.clear(box);
    await userEvent.type(box, '0');
    await userEvent.click(screen.getByRole('button', { name: 'Xem trước bản in' }));
    const sheet = within(await screen.findByRole('dialog', { name: 'Xem trước bản in' })).getByRole('region', { name: /Xem trước phiếu A4/ });
    const rows = within(sheet).getAllByRole('row').filter((r) => within(r).queryAllByRole('cell').length > 0);
    expect(rows.map((r) => within(r).getAllByRole('cell').at(-1)?.textContent)).toEqual(['5', '0']);
  });
});
