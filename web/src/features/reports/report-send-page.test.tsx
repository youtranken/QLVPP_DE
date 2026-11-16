import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, screen, userEvent, waitFor, within } from '@/test/test-utils';
import { callsTo, sendReport, sentData, sentState, setupSendAdm, YM, UNSENT } from '@/features/send-adm/send-adm-fixtures';
import { registrationView } from '@/features/summary/registration-fixtures';
import { snapshotRow } from './reports-fixtures';
import { expectFixedColumns } from '@/test/fixed-columns';

import { PAPER, PEN, REPORT, open, qtyBox, snapshotPosts, table } from './report-send-page-fixtures';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
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
    expect(screen.getByRole('button', { name: 'Xem tổng kết' })).toHaveAccessibleDescription('Chưa có món nào cần đặt');
    expect(screen.getByRole('button', { name: 'Xuất Excel' })).toHaveAccessibleDescription('Chưa có món nào cần đặt');
  });

  it('còn một món Đề nghị 1 (phía kia mốc 0) → Xuất/In bật, không mô tả "Chưa có món nào cần đặt"', async () => {
    setupSendAdm({ report: REPORT });
    open();
    const box = await qtyBox('Bút bi');
    await userEvent.clear(box);
    await userEvent.type(box, '0');
    const paper = await qtyBox('Giấy A4');
    await userEvent.clear(paper);
    await userEvent.type(paper, '1');
    expect(screen.getByRole('button', { name: 'Xem tổng kết' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Xem tổng kết' })).not.toHaveAccessibleDescription('Chưa có món nào cần đặt');
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
    expect(within(dialog).getByText(/^Bấm Hủy thì không lưu bản này\.$/)).toBeInTheDocument();
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

  it('kỳ cũ hơn chưa gửi NCC: Xuất Excel / Xem tổng kết khóa kèm lý do "Kỳ này chưa gửi NCC"', async () => {
    const older = sendReport([PEN, PAPER], { ym: '2026-09' });
    setupSendAdm({
      report: REPORT,
      extra: (url) => {
        if (url === '/api/admin/reports/2026-09') return jsonResponse(200, older);
        if (url === '/api/admin/periods/2026-09/send-state') return jsonResponse(200, UNSENT);
        if (url === '/api/admin/periods/2026-09/summary') return jsonResponse(200, { ym: '2026-09', deadline: '2026-09-10T17:00:00Z', is_open: false, registered: 3, headcount: 3, unregistered: 0, custom_pending: 0, lines_pending_delivery: 0 });
        if (url.startsWith('/api/admin/periods/2026-09/requests?by=item')) return jsonResponse(200, { items: [] });
        if (url.startsWith('/api/admin/reports/2026-09/snapshots')) return jsonResponse(200, { items: [] });
        return undefined;
      },
    });
    open('/admin/reports?ym=2026-09');
    for (const name of ['Xuất Excel', 'Xem tổng kết']) {
      const btn = await screen.findByRole('button', { name });
      expect(btn).toBeDisabled();
      await waitFor(() => expect(btn).toHaveAccessibleDescription('Kỳ này chưa gửi NCC'));
    }
  });

  const olderSetup = (byItem: () => Response) => {
    const older = sendReport([PEN, PAPER], { ym: '2026-09' });
    const oldSent = sentState(sentData(older, { kA: 9, kB: 4 }, { period_ym: '2026-09' }));
    setupSendAdm({
      report: REPORT,
      extra: (url) => {
        if (url === '/api/admin/reports/2026-09') return jsonResponse(200, older);
        if (url === '/api/admin/periods/2026-09/send-state') return jsonResponse(200, oldSent);
        if (url.startsWith('/api/admin/periods/2026-09/requests?by=item')) return byItem();
        if (url.startsWith('/api/admin/reports/2026-09/snapshots')) return jsonResponse(200, { items: [] });
        return undefined;
      },
    });
    open('/admin/reports?ym=2026-09');
  };
  const whoCells = async () => {
    const t = await table();
    await waitFor(() => expect(t.getAllByRole('row').some((r) => r.textContent?.includes('Giấy A4'))).toBe(true));
    return ['Bút bi', 'Giấy A4'].map((n) => t.getAllByRole('row').find((r) => r.textContent?.includes(n))!.lastElementChild!);
  };

  it('kỳ cũ hơn: cột "Ai đăng ký" có số người theo key của bản đã gửi; món không ai đăng ký mới là "—"', async () => {
    olderSetup(() => jsonResponse(200, { items: [{ key: 'kA', item_id: 'kA', name: 'Bút bi', unit: 'cay', requested_qty: 5, people: 3, max_qty: 5, over_max: false }] }));
    const [pen, paper] = await whoCells();
    await waitFor(() => expect(pen).toHaveTextContent('3 người'));
    expect(paper).toHaveTextContent('—');
  });

  it('kỳ cũ hơn: tải số người lỗi → báo "Chưa tải được ai đăng ký" + Thử lại, ô không hiện "—"', async () => {
    olderSetup(() => jsonResponse(429, { code: 'TOO_MANY_REQUESTS' }));
    expect(await screen.findByText('Chưa tải được ai đăng ký từng món.', {}, { timeout: 4000 })).toBeInTheDocument();
    const cells = await whoCells();
    for (const c of cells) expect(c).not.toHaveTextContent('—');
    // L2 vòng 8: lỗi thì ô thôi báo "đang tải" (không aria-busy, không "Đang tải số người"), hiện "?" + chữ ẩn "Chưa tải được"
    for (const c of cells) {
      expect(c.querySelector('[aria-busy]')).toBeNull();
      expect(c).not.toHaveTextContent('Đang tải số người');
      expect(c).toHaveTextContent('?Chưa tải được số người');
    }
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
    // < 768 bảng thành thẻ như bảng trang: mỗi ô có nhãn cột (data-label), ô ghi chú rỗng để CSS ẩn ở thẻ / hiện "—" ở bảng
    const table = within(dialog).getByRole('table');
    expect(table).toHaveClass('table-stack');
    const cells = within(within(dialog).getAllByRole('row')[1]!).getAllByRole('cell');
    expect(cells.map((c) => c.getAttribute('data-label'))).toEqual([null, 'Nhóm', 'Số lượng', 'Ghi chú', null]);
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

describe('Báo cáo & gửi NCC: cột cố định', () => {
  it('bảng món cố định bề rộng cột: tháng có ô nhập Đề nghị và tháng chỉ có số cùng một bố cục cột', async () => {
    setupSendAdm({ report: REPORT });
    open();
    await qtyBox('Bút bi');
    expectFixedColumns((await screen.findAllByRole('table'))[0]!);
  });
});
