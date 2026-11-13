import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, userEvent, waitFor, within } from '@/test/test-utils';
import { renderApp } from '@/test/render-app';
import { makeMe } from '@/test/fixtures-me';
import { mockViewport } from '@/test/viewport';
import { callsTo, itemRow, sendReport, setupSendAdm, YM } from '@/features/send-adm/send-adm-fixtures';
import { captureDownloads, errorResponse } from './reports-test-stub';

const PEN = itemRow({ key: 'kA', name: 'Bút bi', requested: 5, need: 5 });
const PAPER = itemRow({ key: 'kB', name: 'Giấy A4', requested: 3, need: 3 });
const REPORT = sendReport([PEN, PAPER]);

function open(path = '/admin/reports') {
  mockViewport(1280);
  renderApp(makeMe('admin'), path);
}
const qtyBox = (name: string) => screen.findByRole('spinbutton', { name: `Đề nghị: ${name}` });

const snapshotPosts = (f: Parameters<typeof callsTo>[0]) => callsTo(f, 'POST', `/api/admin/reports/${YM}/snapshots`).filter((c) => c.url.endsWith('/snapshots'));

const reportLoads = (f: Parameters<typeof callsTo>[0]) => f.mock.calls.filter((c) => c[0] === `/api/admin/reports/${YM}`).length;

const PENDING6 = ['Dây rút', 'Sổ tay', 'Bút lông', 'Kệ tài liệu', 'Pin sạc', 'Ghim bấm'].map((name, i) => ({ line_id: `l${i}`, name }));

async function zeroAll() {
  for (const name of ['Bút bi', 'Giấy A4']) {
    const box = await qtyBox(name);
    await userEvent.clear(box);
    await userEvent.type(box, '0');
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// Chốt bản khi còn món ngoài danh mục chờ: báo trước, gửi xác nhận số món, 409 thì tải lại
describe('Báo cáo & gửi NCC: món ngoài danh mục chờ khi chốt bản', () => {
  it('có món ngoài DM chờ duyệt → hộp xem trước liệt kê tối đa 5 tên sẽ ghi Không mua (và k món nữa), focus ở Hủy; Đồng ý gửi cờ + expected_pending', async () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => undefined);
    const f = setupSendAdm({ report: sendReport([PEN, PAPER], { pending_custom_count: 6, pending_custom: PENDING6 }) });
    open();
    await qtyBox('Bút bi');
    await userEvent.click(screen.getByRole('button', { name: 'Xem tổng kết' }));
    const dialog = await screen.findByRole('dialog', { name: /Xem tổng kết tháng/ });
    expect(within(dialog).getByText('Còn 6 món ngoài danh mục chưa duyệt. Chốt bản này sẽ ghi Không mua cho:')).toBeInTheDocument();
    const names = within(within(dialog).getByRole('list')).getAllByRole('listitem').map((li) => li.textContent);
    expect(names).toEqual(['Dây rút', 'Sổ tay', 'Bút lông', 'Kệ tài liệu', 'Pin sạc']);
    expect(within(dialog).getByText('(và 1 món nữa)')).toBeInTheDocument();
    expect(within(dialog).queryByRole('link', { name: 'Xem món ngoài danh mục' })).toBeNull();
    expect(within(dialog).getByText('Bấm Hủy thì không lưu bản này.')).toBeInTheDocument();
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Hủy' })).toHaveFocus());
    expect(screen.queryByRole('dialog', { name: 'Chốt phiếu gửi NCC?' })).toBeNull();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Đồng ý và in' }));
    await waitFor(() => expect(snapshotPosts(f)).toHaveLength(1));
    expect(snapshotPosts(f)[0]!.body).toMatchObject({ kind: 'print', reject_pending_custom: true, expected_pending: 6 });
    await waitFor(() => expect(print).toHaveBeenCalled());
  });

  it('không còn món chờ → không cảnh báo, gửi expected_pending 0, không gửi cờ', async () => {
    vi.spyOn(window, 'print').mockImplementation(() => undefined);
    const f = setupSendAdm({ report: REPORT });
    open();
    await qtyBox('Bút bi');
    await userEvent.click(screen.getByRole('button', { name: 'Xem tổng kết' }));
    const dialog = await screen.findByRole('dialog', { name: /Xem tổng kết tháng/ });
    expect(within(dialog).queryByText(/chưa duyệt/)).toBeNull();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Đồng ý và in' }));
    await waitFor(() => expect(snapshotPosts(f)).toHaveLength(1));
    expect(snapshotPosts(f)[0]!.body).toMatchObject({ expected_pending: 0 });
    expect(snapshotPosts(f)[0]!.body).not.toHaveProperty('reject_pending_custom');
  });

  it('Đồng ý và in bị 409 PENDING_CUSTOM → báo "Danh sách món chờ duyệt vừa thay đổi, xem lại rồi xác nhận." và tải lại báo cáo', async () => {
    const f = setupSendAdm({ report: sendReport([PEN, PAPER], { pending_custom_count: 1, pending_custom: PENDING6.slice(0, 1) }), stub: { post: () => errorResponse(409, 'PENDING_CUSTOM') } });
    open();
    await qtyBox('Bút bi');
    const loads = () => f.mock.calls.filter((c) => c[0] === `/api/admin/reports/${YM}`).length;
    const before = loads();
    await userEvent.click(screen.getByRole('button', { name: 'Xem tổng kết' }));
    const dialog = await screen.findByRole('dialog', { name: /Xem tổng kết tháng/ });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Đồng ý và in' }));
    expect(await screen.findByText('Danh sách món chờ duyệt vừa thay đổi, xem lại rồi xác nhận.')).toBeInTheDocument();
    await waitFor(() => expect(loads()).toBeGreaterThan(before));
  });

  it('Xem tổng kết lỗi ORDER_EMPTY → báo ở đầu trang, không mở hộp', async () => {
    setupSendAdm({ report: REPORT, stub: { preview: () => errorResponse(409, 'ORDER_EMPTY') } });
    open();
    await qtyBox('Bút bi');
    await userEvent.click(screen.getByRole('button', { name: 'Xem tổng kết' }));
    expect(await screen.findByText('Chưa có món nào để đề nghị.')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('Xuất Excel khi có món ngoài DM chờ duyệt: hộp "Chốt phiếu gửi NCC?" cùng khung cảnh báo, focus Quay lại; xác nhận gửi cờ', async () => {
    // Tải tệp bằng <a download> thật: jsdom không tải được (in "Not implemented: navigation"), ghi lại thay vì bấm
    const downloads = captureDownloads();
    const f = setupSendAdm({ report: sendReport([PEN, PAPER], { pending_custom_count: 2, pending_custom: PENDING6.slice(0, 2) }) });
    open();
    await qtyBox('Bút bi');
    await userEvent.click(screen.getByRole('button', { name: 'Xuất Excel' }));
    const dialog = await screen.findByRole('dialog', { name: 'Chốt phiếu gửi NCC?' });
    expect(within(dialog).getByText('Còn 2 món ngoài danh mục chưa duyệt. Chốt bản này sẽ ghi Không mua cho:')).toBeInTheDocument();
    expect(within(dialog).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Dây rút', 'Sổ tay']);
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Quay lại' })).toHaveFocus());
    await userEvent.click(within(dialog).getByRole('button', { name: 'Xuất Excel mẫu phòng' }));
    await waitFor(() => expect(snapshotPosts(f)).toHaveLength(1));
    expect(snapshotPosts(f)[0]!.body).toMatchObject({ kind: 'xlsx', reject_pending_custom: true, expected_pending: 2 });
    await waitFor(() => expect(downloads.map((d) => d.name)).toEqual([`vpp-bao-cao-${YM}.xlsx`]));
  });

  it('Xuất Excel bị 409 PENDING_CUSTOM → hộp vẫn mở, báo đỏ trong hộp, không chốt', async () => {
    setupSendAdm({ report: sendReport([PEN, PAPER], { pending_custom_count: 2, pending_custom: PENDING6.slice(0, 2) }), stub: { post: () => errorResponse(409, 'PENDING_CUSTOM') } });
    open();
    await qtyBox('Bút bi');
    await userEvent.click(screen.getByRole('button', { name: 'Xuất Excel' }));
    const dialog = await screen.findByRole('dialog', { name: 'Chốt phiếu gửi NCC?' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Xuất Excel mẫu phòng' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Danh sách món chờ duyệt vừa thay đổi, xem lại rồi xác nhận.');
  });

  it('Không cần đề nghị khi còn món chờ: hộp xác nhận kèm danh sách sẽ ghi Không mua; xác nhận gửi cờ + expected_pending', async () => {
    const f = setupSendAdm({ report: sendReport([PEN, PAPER], { pending_custom_count: 1, pending_custom: PENDING6.slice(0, 1) }) });
    open();
    for (const name of ['Bút bi', 'Giấy A4']) {
      const box = await qtyBox(name);
      await userEvent.clear(box);
      await userEvent.type(box, '0');
    }
    await userEvent.click(screen.getByRole('button', { name: 'Tháng này không cần đề nghị NCC' }));
    const dialog = await screen.findByRole('dialog', { name: 'Tháng này không cần đề nghị NCC?' });
    expect(within(dialog).getByText('Còn 1 món ngoài danh mục chưa duyệt. Chốt bản này sẽ ghi Không mua cho:')).toBeInTheDocument();
    expect(within(dialog).getByText('Dây rút')).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Xác nhận' }));
    await waitFor(() => expect(callsTo(f, 'POST', `/api/admin/periods/${YM}/no-order`)).toHaveLength(1));
    expect(callsTo(f, 'POST', `/api/admin/periods/${YM}/no-order`)[0]!.body).toMatchObject({ reject_pending_custom: true, expected_pending: 1 });
  });
  it('Xuất Excel có ghi Không mua thành công → tải lại báo cáo sống (số/tên món chờ hết cũ)', async () => {
    const downloads = captureDownloads();
    const f = setupSendAdm({ report: sendReport([PEN, PAPER], { pending_custom_count: 2, pending_custom: PENDING6.slice(0, 2) }) });
    open();
    await qtyBox('Bút bi');
    const before = reportLoads(f);
    await userEvent.click(screen.getByRole('button', { name: 'Xuất Excel' }));
    const dialog = await screen.findByRole('dialog', { name: 'Chốt phiếu gửi NCC?' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Xuất Excel mẫu phòng' }));
    await waitFor(() => expect(snapshotPosts(f)).toHaveLength(1));
    await waitFor(() => expect(reportLoads(f)).toBeGreaterThan(before));
    await waitFor(() => expect(downloads).toHaveLength(1));
  });

  it('Không cần đề nghị có ghi Không mua thành công → tải lại báo cáo sống', async () => {
    const f = setupSendAdm({ report: sendReport([PEN, PAPER], { pending_custom_count: 1, pending_custom: PENDING6.slice(0, 1) }) });
    open();
    await zeroAll();
    const before = reportLoads(f);
    await userEvent.click(screen.getByRole('button', { name: 'Tháng này không cần đề nghị NCC' }));
    await userEvent.click(within(await screen.findByRole('dialog', { name: 'Tháng này không cần đề nghị NCC?' })).getByRole('button', { name: 'Xác nhận' }));
    await waitFor(() => expect(callsTo(f, 'POST', `/api/admin/periods/${YM}/no-order`)).toHaveLength(1));
    await waitFor(() => expect(reportLoads(f)).toBeGreaterThan(before));
  });

  it('Không cần đề nghị bị 409 PENDING_CUSTOM → báo "Danh sách món chờ duyệt vừa thay đổi, xem lại rồi xác nhận." và tải lại báo cáo', async () => {
    const f = setupSendAdm({
      report: sendReport([PEN, PAPER], { pending_custom_count: 1, pending_custom: PENDING6.slice(0, 1) }),
      extra: (url) => (url === `/api/admin/periods/${YM}/no-order` ? errorResponse(409, 'PENDING_CUSTOM') : undefined),
    });
    open();
    await zeroAll();
    const before = reportLoads(f);
    await userEvent.click(screen.getByRole('button', { name: 'Tháng này không cần đề nghị NCC' }));
    await userEvent.click(within(await screen.findByRole('dialog', { name: 'Tháng này không cần đề nghị NCC?' })).getByRole('button', { name: 'Xác nhận' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Danh sách món chờ duyệt vừa thay đổi, xem lại rồi xác nhận.');
    await waitFor(() => expect(reportLoads(f)).toBeGreaterThan(before));
  });
});
