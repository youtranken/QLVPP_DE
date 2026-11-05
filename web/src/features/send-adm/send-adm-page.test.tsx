import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, screen, userEvent, waitFor, within } from '@/test/test-utils';
import { renderApp } from '@/test/render-app';
import { makeMe } from '@/test/fixtures-me';
import { mockViewport } from '@/test/viewport';
import i18n from '@/lib/i18n';
import { adminItem } from '@/features/summary/adjust-fixtures';
import type { MonthReport } from '@/features/reports/reports.api';
import { reportFixture } from '@/features/reports/reports-fixtures';
import { captureDownloads, postsOf, stubReports } from '@/features/reports/reports-test-stub';

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

function setup(over: { report?: MonthReport; deadline?: string; summary?: object } = {}) {
  const base = stubReports({ reports: { '2026-10': over.report ?? REPORT }, items: ITEMS });
  const f = vi.fn(async (url: string, init?: RequestInit) => {
    if (url === SUMMARY_URL) return jsonResponse(200, { ym: '2026-10', deadline: over.deadline ?? PAST, unregistered: 3, custom_pending: 1, lines_pending_delivery: 0, ...over.summary });
    if (url === '/api/admin/config') return jsonResponse(200, { signature_boxes: BOXES });
    return base(url, init);
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

const qtyBox = (name: string) => screen.findByRole('spinbutton', { name: `Đề nghị: ${name}` }) as Promise<HTMLInputElement>;
const preview = () => screen.getByRole('region', { name: /Xem trước phiếu A4|A4 form preview/ });
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
  it('3 mục: người chưa đăng ký và món ngoài danh mục là cảnh báo có link, trừ tủ luôn xanh', async () => {
    setup();
    await open();
    const list = await screen.findByRole('list', { name: 'Kiểm trước khi gửi' });
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent('3 người chưa đăng ký');
    expect(within(items[0]).getByRole('link', { name: 'Tổng hợp kỳ' })).toHaveAttribute('href', '/admin/summary?ym=2026-10&filter=unregistered');
    expect(items[1]).toHaveTextContent('1 món ngoài danh mục chưa duyệt');
    expect(within(items[1]).getByRole('link', { name: 'Món ngoài danh mục' })).toHaveAttribute('href', '/admin/review?status=pending&ym=2026-10');
    expect(items[2]).toHaveTextContent('Đã trừ hàng trong tủ');
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
    expect(await screen.findByText(/^Kỳ tháng 10 chưa khóa sổ, mở lại sau/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Xuất Excel mẫu phòng' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'In trình ký' })).toBeNull();
  });
});

describe('SendAdmPage — số đề nghị và xem trước', () => {
  it('mặc định Đề nghị = Cần; sửa 13 → 10 thì phiếu hiện 10; món 0 không có trong phiếu', async () => {
    setup();
    await open();
    const a = await qtyBox('Bút bi xanh');
    expect(a).toHaveValue(13);
    expect(within(preview()).getByRole('row', { name: /Bút bi xanh/ })).toHaveTextContent('13');
    await retype(a, '10');
    expect(within(preview()).getByRole('row', { name: /Bút bi xanh/ })).toHaveTextContent('10');
    await retype(await qtyBox('Giấy A4'), '0');
    expect(within(preview()).queryByRole('row', { name: /Giấy A4/ })).toBeNull();
    expect(within(preview()).getAllByRole('row').slice(1).map((r) => within(r).getAllByRole('cell')[0].textContent)).toEqual(['1', '2', '3']);
  });

  it('Xuất Excel mẫu phòng gọi createSnapshot với order_qty chứa 10 và tải tệp', async () => {
    const f = setup();
    const saved = captureDownloads();
    await open();
    await retype(await qtyBox('Bút bi xanh'), '10');
    await userEvent.click(xlsx());
    await waitFor(() => expect(postsOf(f)).toHaveLength(1));
    expect(postsOf(f)[0]).toEqual({ url: '/api/admin/reports/2026-10/snapshots', body: { kind: 'xlsx', order_qty: { kA: 10 } } });
    await waitFor(() => expect(saved).toHaveLength(1));
  });

  it('In trình ký gọi createSnapshot kind print và báo có link mở bản in', async () => {
    const f = setup();
    await open();
    await userEvent.click(print());
    await waitFor(() => expect(postsOf(f).map((p) => p.body.kind)).toEqual(['print']));
    expect(await screen.findByRole('button', { name: 'Mở bản in' })).toBeInTheDocument();
  });

  it('còn món chờ duyệt trong báo cáo: hỏi trước khi chốt, chưa gửi', async () => {
    const f = setup({ report: { ...REPORT, pending_custom_count: 1 } });
    await open();
    await userEvent.click(xlsx());
    expect(await screen.findByRole('dialog', { name: /món ngoài danh mục chưa xem/ })).toBeInTheDocument();
    expect(postsOf(f)).toHaveLength(0);
  });

  it('món ngừng bán còn cần đặt vẫn nằm trong bảng và phiếu như trang Báo cáo; món ngoài danh mục có dòng và không có ô tủ', async () => {
    setup();
    await open();
    expect(await qtyBox('Món ngừng bán')).toHaveValue(2);
    expect(within(preview()).getByRole('row', { name: /Món ngừng bán/ })).toBeInTheDocument();
    const custom = within(screen.getByRole('table', { name: 'Số đề nghị theo món' })).getByRole('row', { name: /Băng keo lạ/ });
    expect(custom).toHaveTextContent('Ngoài danh mục');
    expect(within(preview()).getByRole('row', { name: /Băng keo lạ/ })).toHaveTextContent('—');
  });

  it('tiếng Anh: bảng dùng tên EN; phiếu vẫn song ngữ cố định', async () => {
    setup();
    await i18n.changeLanguage('en');
    mockViewport(1280);
    renderApp(makeMe('admin'), '/admin/send-adm');
    expect(await screen.findByRole('spinbutton', { name: 'Request: Blue pen' })).toBeInTheDocument();
    expect(within(preview()).getByRole('row', { name: /Bút bi xanh/ })).toHaveTextContent('Blue pen');
  });

  it('hai ô ký trong phiếu lấy từ cấu hình', async () => {
    setup();
    await open();
    expect(await within(preview()).findByRole('group', { name: 'Chủ quản đơn vị' })).toHaveTextContent('Ngô Văn Bảo');
    expect(within(preview()).getByRole('group', { name: 'Người yêu cầu' })).toBeInTheDocument();
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

  it('ô trống: lỗi gắn ô, nút xuất vô hiệu; phiếu giữ số Cần cho dòng đó', async () => {
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
