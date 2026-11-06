import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, screen, userEvent, waitFor, within } from '@/test/test-utils';
import { renderApp } from '@/test/render-app';
import { makeMe } from '@/test/fixtures-me';
import { mockViewport } from '@/test/viewport';
import i18n from '@/lib/i18n';
import { adminItem } from '@/features/summary/adjust-fixtures';
import type { MonthReport } from '@/features/reports/reports.api';
import { reportFixture } from '@/features/reports/reports-fixtures';
import { captureDownloads, errorResponse, postsOf, stubReports } from '@/features/reports/reports-test-stub';
import type { SendStateDto } from './send-adm.api';
import { sentData, sentState, UNSENT } from './send-adm-fixtures';

const SUMMARY_URL = '/api/admin/periods/2026-10/summary';
const PAST = '2026-10-10T17:00:00.000Z';
const BOXES = [
  { title: 'Chủ quản đơn vị', title_en: 'Head of Dept.', name: 'Ngô Văn Bảo' },
  { title: 'Người yêu cầu', title_en: 'Applicant', name: '' },
];

const row = (o: Partial<MonthReport['byItem'][number]> & { key: string }) => ({ item_id: o.key, code: null, name: o.key, name_en: null, unit: 'cay', requested: 0, backlog_prev: 0, stock: 0, need: 0, ...o });
const REPORT = reportFixture({
  byItem: [
    row({ key: 'kA', code: 'B31', name: 'Bút bi xanh', name_en: 'Blue pen', requested: 13, need: 13 }),
    row({ key: 'kB', code: 'G11', name: 'Giấy A4', name_en: 'Paper A4', requested: 8, stock: 2, need: 6 }),
    row({ key: 'kOff', code: 'X01', name: 'Món ngừng bán', requested: 2, need: 2 }),
  ],
  custom: [{ key: 'kC', name: 'Băng keo lạ', unit: 'cuon', requested: 2, backlog_prev: 0, stock: null, need: 2, people: 1 }],
});
const ITEMS = [adminItem({ id: 'kA', name: 'Bút bi xanh' }), adminItem({ id: 'kB', name: 'Giấy A4' }), adminItem({ id: 'kOff', name: 'Món ngừng bán', active: false })];

type StubOptions = NonNullable<Parameters<typeof stubReports>[0]>;

// afterPost: trạng thái gửi sau khi POST bản chốt thành công (trang chuyển sang Đã gửi như thật)
function setup(over: { report?: MonthReport; deadline?: string; summary?: object; items?: typeof ITEMS; post?: StubOptions['post']; exportFile?: StubOptions['exportFile']; afterPost?: SendStateDto } = {}) {
  const base = stubReports({ reports: { '2026-10': over.report ?? REPORT }, items: over.items ?? ITEMS, post: over.post, exportFile: over.exportFile });
  let state = UNSENT;
  const f = vi.fn(async (url: string, init?: RequestInit) => {
    if (url === SUMMARY_URL) return jsonResponse(200, { ym: '2026-10', deadline: over.deadline ?? PAST, unregistered: 3, custom_pending: 1, lines_pending_delivery: 0, ...over.summary });
    if (url === '/api/admin/config') return jsonResponse(200, { signature_boxes: BOXES });
    if (url === '/api/admin/periods/2026-10/send-state') return jsonResponse(200, state);
    const res = await base(url, init);
    if (init?.method === 'POST' && res.ok && over.afterPost) state = over.afterPost;
    return res;
  });
  vi.stubGlobal('fetch', f);
  return f;
}

async function open() {
  mockViewport(1280);
  renderApp(makeMe('admin'), '/admin/send-adm');
  await screen.findByRole('heading', { level: 1, name: 'Gửi ADM, kỳ tháng 10' });
  await screen.findByRole('button', { name: 'Xuất Excel mẫu phòng' });
}

const table = () => screen.getByRole('table', { name: 'Số đề nghị theo món' });
const rowOf = (name: string) => within(table()).getByRole('row', { name: new RegExp(name) });
// Ô Đề nghị là chữ tới khi bấm "Sửa số"
async function qtyBox(name: string) {
  await screen.findByRole('table', { name: 'Số đề nghị theo món' });
  const row = rowOf(name);
  const open = within(row).queryByRole('button', { name: 'Sửa số' });
  if (open) await userEvent.click(open);
  return within(row).getByRole('spinbutton') as HTMLInputElement;
}
async function preview() {
  await userEvent.click(screen.getByRole('button', { name: 'Xem trước bản in' }));
  return within(await screen.findByRole('dialog', { name: 'Xem trước bản in' })).getByRole('region', { name: /Xem trước phiếu A4|A4 form preview/ });
}
const closePreview = () => userEvent.keyboard('{Escape}');
const xlsx = () => screen.getByRole('button', { name: 'Xuất Excel mẫu phòng' });
const print = () => screen.getByRole('button', { name: 'In trình ký' });
const retype = async (el: HTMLElement, text: string) => {
  await userEvent.clear(el);
  if (text) await userEvent.type(el, text);
};

afterEach(async () => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  await i18n.changeLanguage('vi');
});

describe('SendAdmPage — kiểm trước khi gửi', () => {
  it('3 mục: người chưa đăng ký và món ngoài danh mục là cảnh báo có link, tủ chỉ tham khảo luôn xanh', async () => {
    setup();
    await open();
    const list = await screen.findByRole('list', { name: 'Kiểm trước khi gửi' });
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent('3 người chưa đăng ký');
    expect(within(items[0]).getByRole('link', { name: 'Tổng hợp kỳ' })).toHaveAttribute('href', '/admin/summary?ym=2026-10&filter=unregistered');
    expect(items[1]).toHaveTextContent('1 món ngoài danh mục chưa duyệt');
    expect(within(items[1]).getByRole('link', { name: 'Món ngoài danh mục' })).toHaveAttribute('href', '/admin/review?status=pending&ym=2026-10');
    expect(items[2]).toHaveTextContent('Tủ chỉ để tham khảo, không trừ vào số đề nghị');
    expect(items[0]).toHaveAttribute('data-tone', 'warn');
    expect(items[2]).toHaveAttribute('data-tone', 'ok');
  });

  it('hết người chưa đăng ký và món chờ duyệt: hai mục đổi sang xanh, không còn link', async () => {
    setup({ summary: { unregistered: 0, custom_pending: 0 } });
    await open();
    const list = await screen.findByRole('list', { name: 'Kiểm trước khi gửi' });
    const items = within(list).getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('Mọi người đã đăng ký');
    expect(items[1]).toHaveTextContent('Không còn món ngoài danh mục chờ duyệt');
    expect(within(list).queryAllByRole('link')).toHaveLength(0);
    expect(items[0]).toHaveAttribute('data-tone', 'ok');
  });

  it('kỳ chưa khóa: thông báo, không có nút thao tác', async () => {
    setup({ deadline: '2999-10-10T17:00:00.000Z' });
    mockViewport(1280);
    renderApp(makeMe('admin'), '/admin/send-adm');
    expect(await screen.findByText('Kỳ tháng 10 chưa khóa sổ — xem được từ 00:00 ngày 11/10.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Xuất Excel mẫu phòng' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'In trình ký' })).toBeNull();
  });
});

describe('SendAdmPage — số đề nghị và xem trước', () => {
  it('cột Tổng cần = đã xin + nợ (8), Tủ 2 chỉ tham khảo, Đề nghị mặc định = 8 (không trừ tủ); món ngoài DM cũng cộng nợ', async () => {
    setup({ report: { ...REPORT, custom: [{ ...REPORT.custom[0], requested: 2, backlog_prev: 3, need: 5 }] } });
    await open();
    const nums = (name: string) => within(rowOf(name)).getAllByRole('cell').slice(1, 5).map((c) => c.textContent);
    expect(nums('Giấy A4')).toEqual(['8', '0', '2', '8']);
    expect(nums('Băng keo lạ')).toEqual(['2', '3', '—', '5']);
    expect(within(rowOf('Giấy A4')).getByText('8', { selector: 'b' })).toBeInTheDocument();
    expect(within(rowOf('Băng keo lạ')).getByText('5', { selector: 'b' })).toBeInTheDocument();
  });

  it('chữ công thức và dòng giới thiệu mới, không còn "trừ tủ"', async () => {
    setup();
    await open();
    expect(screen.getByText('Số đề nghị app tự tính từ phiếu nhân viên. Chỉ sửa khi muốn xin dư hoặc bỏ món.')).toBeInTheDocument();
    expect(screen.getByText('Đề nghị mặc định = Chưa giao kỳ này + Nợ kỳ trước. Tủ chỉ để tham khảo, không trừ. Muốn bớt thì sửa ô Đề nghị.')).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/trừ tủ/);
  });

  it('mặc định Đề nghị 13; sửa 13 → 10 thì phiếu hiện 10; món sửa 0 vẫn có hàng SL 0 như tờ in', async () => {
    setup();
    await open();
    const a = await qtyBox('Bút bi xanh');
    expect(a).toHaveValue(13);
    await retype(a, '10');
    await retype(await qtyBox('Giấy A4'), '0');
    const sheet = await preview();
    expect(within(sheet).getByRole('row', { name: /Bút bi xanh/ })).toHaveTextContent('10');
    expect(within(sheet).getByRole('row', { name: /Giấy A4/ })).toHaveTextContent(/0$/);
    expect(within(sheet).getAllByRole('row').slice(1).map((r) => within(r).getAllByRole('cell')[0].textContent)).toEqual(['1', '2', '3', '4']);
  });

  it('Xuất Excel mẫu phòng gọi createSnapshot với order_qty chứa 10, reuse_if_unchanged, và tải tệp', async () => {
    const f = setup();
    const saved = captureDownloads();
    await open();
    await retype(await qtyBox('Bút bi xanh'), '10');
    await userEvent.click(xlsx());
    await waitFor(() => expect(postsOf(f)).toHaveLength(1));
    expect(postsOf(f)[0]).toEqual({ url: '/api/admin/reports/2026-10/snapshots', body: { kind: 'xlsx', order_qty: { kA: 10 }, reuse_if_unchanged: true } });
    await waitFor(() => expect(saved).toHaveLength(1));
  });

  it('Xuất Excel: POST ok, tải tệp 500 → lỗi "Không tải được tệp — thử lại." ở mục Bản chốt (cả khi đã về Đã gửi), không toast; "Thử lại" tải lại, 0 POST thêm', async () => {
    const f = setup({ exportFile: () => errorResponse(500, 'INTERNAL'), afterPost: sentState(sentData(REPORT, { kA: 13 }, { id: 'snap-1' })) });
    await open();
    await userEvent.click(xlsx());
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Không tải được tệp — thử lại.');
    expect(await screen.findByText(/^Đã gửi ADM lúc/)).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Không tải được tệp — thử lại.');
    expect(screen.queryByText(/^Đã xuất Excel/)).toBeNull();
    await userEvent.click(within(screen.getByRole('alert')).getByRole('button', { name: 'Thử lại' }));
    await waitFor(() => expect(f.mock.calls.filter((c) => String(c[0]).includes('/export.xlsx'))).toHaveLength(2));
    expect(postsOf(f)).toHaveLength(1);
  });

  it('POST 400 INVALID_PERIOD ở tháng mặc định → khối "Tháng này chưa tới, chưa lập báo cáo được." và tải lại kỳ hiện tại', async () => {
    const f = setup({ post: () => errorResponse(400, 'INVALID_PERIOD') });
    await open();
    const periodCalls = () => f.mock.calls.filter((c) => c[0] === '/api/periods/current').length;
    const before = periodCalls();
    await userEvent.click(print());
    expect(await screen.findByRole('alert')).toHaveTextContent('Tháng này chưa tới, chưa lập báo cáo được.');
    await waitFor(() => expect(periodCalls()).toBeGreaterThan(before));
  });

  it('In trình ký gọi createSnapshot kind print và báo có link mở bản in', async () => {
    const f = setup();
    await open();
    await userEvent.click(print());
    await waitFor(() => expect(postsOf(f).map((p) => p.body.kind)).toEqual(['print']));
    expect(await screen.findByRole('button', { name: 'Mở bản in' })).toBeInTheDocument();
  });

  it('ORDER_EMPTY từ server → báo "Chưa có món nào để đề nghị."', async () => {
    setup();
    const base = vi.mocked(fetch);
    const inner = base.getMockImplementation()!;
    base.mockImplementation(async (url, init) => (init?.method === 'POST' ? new Response(JSON.stringify({ code: 'ORDER_EMPTY', message: 'x' }), { status: 409, headers: { 'Content-Type': 'application/json' } }) : inner(url, init)));
    await open();
    await userEvent.click(print());
    expect(await screen.findByRole('alert')).toHaveTextContent('Chưa có món nào để đề nghị.');
  });

  it('còn món chờ duyệt trong báo cáo: hỏi trước khi chốt, chưa gửi', async () => {
    const f = setup({ report: { ...REPORT, pending_custom_count: 1 } });
    await open();
    await userEvent.click(xlsx());
    expect(await screen.findByRole('dialog', { name: 'Chốt phiếu gửi ADM?' })).toHaveTextContent('Còn 1 món ngoài danh mục chưa xem');
    expect(postsOf(f)).toHaveLength(0);
  });

  it('món ngừng bán còn người đăng ký vẫn nằm trong bảng và phiếu; món ngoài danh mục có dòng và không có ô tủ', async () => {
    setup();
    await open();
    expect(await qtyBox('Món ngừng bán')).toHaveValue(2);
    expect(rowOf('Băng keo lạ')).toHaveTextContent('Ngoài danh mục');
    const sheet = await preview();
    expect(within(sheet).getByRole('row', { name: /Món ngừng bán/ })).toBeInTheDocument();
    expect(within(sheet).getByRole('row', { name: /Băng keo lạ/ })).toHaveTextContent('—');
  });

  it('tiếng Anh: bảng dùng tên EN; phiếu vẫn song ngữ cố định', async () => {
    setup();
    await i18n.changeLanguage('en');
    mockViewport(1280);
    renderApp(makeMe('admin'), '/admin/send-adm');
    const row = within(await screen.findByRole('table', { name: 'Quantities to request by item' })).getByRole('row', { name: /Blue pen/ });
    await userEvent.click(within(row).getByRole('button', { name: 'Edit' }));
    expect(within(row).getByRole('spinbutton', { name: 'Request: Blue pen' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Preview print' }));
    const sheet = within(await screen.findByRole('dialog', { name: 'Preview print' })).getByRole('region', { name: /A4 form preview/ });
    expect(within(sheet).getByRole('row', { name: /Bút bi xanh/ })).toHaveTextContent('Blue pen');
  });

  it('hai ô ký trong phiếu lấy từ cấu hình', async () => {
    setup();
    await open();
    const sheet = await preview();
    expect(within(sheet).getByRole('group', { name: 'Chủ quản đơn vị' })).toHaveTextContent('Ngô Văn Bảo');
    expect(within(sheet).getByRole('group', { name: 'Người yêu cầu' })).toBeInTheDocument();
    await closePreview();
  });
});

describe('SendAdmPage — biên Đề nghị (0 … 99 999)', () => {
  it('99999 được, 100000 lỗi gắn ô và vô hiệu hai nút, 0 được', async () => {
    setup();
    await open();
    const a = await qtyBox('Bút bi xanh');
    await retype(a, '99999');
    expect(a).not.toHaveAttribute('aria-invalid');
    expect(xlsx()).toBeEnabled();
    await retype(a, '100000');
    expect(a).toHaveAttribute('aria-invalid', 'true');
    expect(a).toHaveAccessibleDescription('Từ 0 đến 99 999.');
    expect(xlsx()).toBeDisabled();
    expect(print()).toBeDisabled();
    await retype(a, '0');
    expect(a).not.toHaveAttribute('aria-invalid');
    expect(xlsx()).toBeEnabled();
  });

  it('ô trống: lỗi gắn ô, nút xuất vô hiệu', async () => {
    const f = setup();
    await open();
    const a = await qtyBox('Bút bi xanh');
    await retype(a, '');
    expect(a).toHaveAttribute('aria-invalid', 'true');
    expect(xlsx()).toBeDisabled();
    await userEvent.click(xlsx());
    expect(postsOf(f)).toHaveLength(0);
  });
});

describe('SendAdmPage — vòng sửa 1', () => {
  it('sửa một ô rồi bấm link ở checklist: hỏi chữ mới; "Ở lại" giữ nguyên trang và số đã gõ', async () => {
    setup();
    await open();
    const a = await qtyBox('Bút bi xanh');
    await retype(a, '10');
    await userEvent.click(within(screen.getByRole('list', { name: 'Kiểm trước khi gửi' })).getByRole('link', { name: 'Tổng hợp kỳ' }));
    const dialog = await screen.findByRole('dialog', { name: 'Bỏ số Đề nghị vừa sửa?' });
    expect(dialog).toHaveTextContent('Bạn đã sửa 1 món nhưng chưa In trình ký. Rời trang sẽ mất các số này.');
    expect(dialog).not.toHaveTextContent('Sang tháng khác');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Ở lại' }));
    expect(screen.getByRole('heading', { level: 1, name: 'Gửi ADM, kỳ tháng 10' })).toBeInTheDocument();
    expect(await qtyBox('Bút bi xanh')).toHaveValue(10);
  });

  it('chưa sửa gì thì link đi thẳng, không hỏi', async () => {
    setup();
    await open();
    await userEvent.click(within(screen.getByRole('list', { name: 'Kiểm trước khi gửi' })).getByRole('link', { name: 'Tổng hợp kỳ' }));
    expect(screen.queryByRole('dialog', { name: 'Bỏ số Đề nghị vừa sửa?' })).toBeNull();
  });

  it('sau khi xuất thành công: rời trang không hỏi', async () => {
    const f = setup();
    const saved = captureDownloads();
    await open();
    await retype(await qtyBox('Bút bi xanh'), '10');
    await userEvent.click(xlsx());
    await waitFor(() => expect(postsOf(f)).toHaveLength(1));
    await waitFor(() => expect(saved).toHaveLength(1));
    await userEvent.click(within(screen.getByRole('list', { name: 'Kiểm trước khi gửi' })).getByRole('link', { name: 'Tổng hợp kỳ' }));
    expect(screen.queryByRole('dialog', { name: 'Bỏ số Đề nghị vừa sửa?' })).toBeNull();
  });

  it('sau khi xuất rồi sửa thêm: rời trang vẫn hỏi', async () => {
    const f = setup();
    const saved = captureDownloads();
    await open();
    await retype(await qtyBox('Bút bi xanh'), '10');
    await userEvent.click(xlsx());
    await waitFor(() => expect(postsOf(f)).toHaveLength(1));
    await waitFor(() => expect(saved).toHaveLength(1));
    await waitFor(() => expect(xlsx()).toBeEnabled());
    await retype(await qtyBox('Giấy A4'), '5');
    await userEvent.click(within(screen.getByRole('list', { name: 'Kiểm trước khi gửi' })).getByRole('link', { name: 'Tổng hợp kỳ' }));
    expect(await screen.findByRole('dialog', { name: 'Bỏ số Đề nghị vừa sửa?' })).toBeInTheDocument();
  });

  it('mọi món Đề nghị 0: hai nút vô hiệu, chưa có bản → nút "Tháng này không cần đề nghị ADM" thay lý do', async () => {
    const f = setup();
    await open();
    for (const name of ['Bút bi xanh', 'Giấy A4', 'Món ngừng bán', 'Băng keo lạ']) await retype(await qtyBox(name), '0');
    expect(xlsx()).toBeDisabled();
    expect(print()).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Tháng này không cần đề nghị ADM' })).toBeInTheDocument();
    await retype(await qtyBox('Giấy A4'), '1');
    expect(xlsx()).toBeEnabled();
    expect(postsOf(f)).toHaveLength(0);
  });

  it('tên EN lấy từ dòng báo cáo, không từ danh mục', async () => {
    setup({ items: ITEMS.map((i) => (i.id === 'kA' ? { ...i, name_en: 'Catalog name' } : i)) });
    await i18n.changeLanguage('en');
    mockViewport(1280);
    renderApp(makeMe('admin'), '/admin/send-adm');
    expect(await screen.findByRole('row', { name: /Blue pen/ })).toBeInTheDocument();
  });
});
