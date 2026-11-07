import { afterEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/lib/i18n';
import { jsonResponse, screen, userEvent, waitFor, within } from '@/test/test-utils';
import { renderApp } from '@/test/render-app';
import { makeMe } from '@/test/fixtures-me';
import { mockViewport } from '@/test/viewport';
import { stubShellApi } from '@/test/admin-shell-stub';

const kpi = (o: object) => ({ ym: '2026-10', deadline: '2026-10-10T17:00:00.000Z', is_open: false, registered: 39, headcount: 40, headcount_source: 'snapshot', unregistered: 0, lines_pending_delivery: 4, custom_pending: 0, low_stock: 0, ...o });
const person = (i: number) => ({ sub: `u${i}`, full_name: `Người số ${i}`, email: null, department: null });
const SENT_AT = '2026-11-05T15:12:00Z';
const sentSnap = { id: 's1', kind: 'print', created_at: SENT_AT, items_count: 11, units_total: 78, replaces: null, data: {} };
const sentState = (o: object = {}) => ({ state: 'sent', no_order_at: null, no_order_by_name: null, sent: sentSnap, changed_after: false, changed_at: null, ...o });
const unsentState = { state: 'unsent', no_order_at: null, no_order_by_name: null, sent: null, changed_after: false, changed_at: null };
type PlanRow = { remaining: number; adm_out?: boolean; usable?: boolean };
const planOf = (rows: PlanRow[], snapshot: object | null = { id: 's1', kind: 'print', created_at: SENT_AT }) => ({
  snapshot,
  batches: [],
  rows: rows.map((r, i) => ({ key: `k${i}`, ordered: r.remaining, received: 0, adm_out: false, usable: true, ...r })),
  custom: [],
  makeup: [],
});

const LEFT_URL = '/api/admin/periods/2026-10/requests?by=person&filter=left&limit=100';
const BACKLOG_URL = '/api/admin/backlog?by=person';
type Debtor = { name: string; status: string };
const debtGroup = ({ name, status }: Debtor) => ({
  key: `u-${name}`,
  label: { user_sub: `u-${name}`, full_name: name, department: null },
  remaining_qty: 2,
  lines: [{ line_id: `l-${name}`, user_sub: `u-${name}`, full_name: name, user_status: status, period_ym: '2026-09', remaining_qty: 2 }],
});

interface Setup {
  locked?: object;
  current?: object;
  send?: object;
  plan?: ReturnType<typeof planOf>;
  unregistered?: number;
  review?: number;
  reviewFails?: boolean;
  unregisteredFails?: boolean;
  low?: { id: string; name: string; name_en: string | null; stock_qty: number }[];
  left?: string[];
  debt?: Debtor[];
}

function setup(o: Setup = {}) {
  return stubShellApi({
    '/api/admin/periods/2026-10/summary': () => jsonResponse(200, kpi(o.locked ?? {})),
    '/api/admin/periods/2026-11/summary': () => jsonResponse(200, kpi({ ym: '2026-11', deadline: '2026-11-10T17:00:00.000Z', is_open: true, registered: 32, unregistered: o.unregistered ?? 0, ...o.current })),
    '/api/admin/periods/2026-10/send-state': () => jsonResponse(200, o.send ?? sentState()),
    '/api/admin/periods/2026-10/arrivals-plan': () => jsonResponse(200, o.plan ?? planOf([{ remaining: 0 }])),
    '/api/admin/periods/2026-11/unregistered': () => (o.unregisteredFails ? jsonResponse(500, null) : jsonResponse(200, { items: Array.from({ length: o.unregistered ?? 0 }, (_, i) => person(i + 1)) })),
    '/api/admin/review?status=pending': () => (o.reviewFails ? jsonResponse(500, null) : jsonResponse(200, { items: Array.from({ length: o.review ?? 0 }, (_, i) => ({ line_id: `l${i}` })) })),
    '/api/admin/stock/low': () => jsonResponse(200, o.low ?? []),
    [LEFT_URL]: () => jsonResponse(200, { items: (o.left ?? []).map((name, i) => ({ request_id: `r-${i}`, user_sub: `u-${name}`, full_name: name, user_status: 'locked' })), next_cursor: null }),
    [BACKLOG_URL]: () => jsonResponse(200, { groups: (o.debt ?? []).map(debtGroup) }),
  });
}

async function open(o: Setup = {}, path = '/admin/home') {
  mockViewport(1280);
  setup(o);
  renderApp(makeMe('admin'), path);
  await screen.findByRole('heading', { level: 1, name: 'Chào Nguyễn Văn An' });
  await screen.findByRole('list', { name: '4 bước của tháng' });
}
const steps = () => within(screen.getByRole('list', { name: '4 bước của tháng' }));
const currentStep = () => steps().getByRole('listitem', { current: 'step' });

afterEach(() => {
  vi.unstubAllGlobals();
  void i18n.changeLanguage('vi');
});

describe('Trang Tháng này: bước hiện tại và nút đi thẳng', () => {
  it.each([
    ['đã khóa, chưa gửi', { send: unsentState, plan: planOf([{ remaining: 13 }], null) }, 'Gửi ADM', 'Mở Gửi ADM', '/admin/send-adm'],
    ['đã gửi, còn chờ về 13', { plan: planOf([{ remaining: 13 }]) }, 'Hàng về', 'Nhập hàng về', '/admin/arrivals'],
    ['hàng đủ, còn 4 dòng chờ giao', {}, 'Giao', 'Mở Giao hàng', '/admin/delivery'],
  ] as const)('%s → bước hiện tại và nút dẫn đúng đường', async (_n, setupArg, step, cta, href) => {
    await open(setupArg as Setup);
    expect(within(currentStep()).getByText(step)).toBeInTheDocument();
    expect(within(currentStep()).getByRole('link', { name: cta })).toHaveAttribute('href', href);
    expect(steps().getAllByRole('link', { name: /^(Mở|Nhập|Xem tổng hợp)/ })).toHaveLength(1);
  });

  it('chuyển sang kỳ đang đăng ký: chỉ bước Đăng ký hoạt động, 3 bước sau mờ "Sau khi khóa sổ"', async () => {
    await open({});
    await userEvent.click(screen.getByRole('radio', { name: 'Kỳ đang đăng ký (tháng 11)' }));
    expect(within(currentStep()).getByText('Đăng ký')).toBeInTheDocument();
    expect(within(currentStep()).getByText('32/40')).toBeInTheDocument();
    // Kỳ mở chưa có Tổng hợp: nút chỉ báo đang chờ chốt, không dẫn sang kỳ khác
    expect(within(currentStep()).getByText('Đang chờ chốt kỳ (tháng 11)')).toBeInTheDocument();
    expect(steps().getAllByText('Sau khi khóa sổ')).toHaveLength(3);
    expect(steps().queryAllByRole('link')).toHaveLength(0);
    expect(screen.getByText('Khóa tự động 00:00 ngày 11/11. Sau đó in phiếu gửi ADM.')).toBeInTheDocument();
  });

  it('kỳ đã khóa: bước Đăng ký có "Xem kỳ (tháng 10)" dẫn tới Tổng hợp kỳ đó', async () => {
    await open({});
    const reg = steps().getAllByRole('listitem')[0]!;
    expect(within(reg).getByRole('link', { name: 'Xem kỳ (tháng 10)' })).toHaveAttribute('href', '/admin/summary?ym=2026-10');
  });

  it('kỳ giao hiện tên món theo ngôn ngữ ở thẻ tủ sắp hết (en dùng name_en)', async () => {
    await open({ low: [{ id: 'k', name: 'Giấy A4', name_en: 'Paper A4', stock_qty: 2 }] });
    expect(await screen.findByText('Giấy A4')).toBeInTheDocument();
    await i18n.changeLanguage('en');
    expect(await screen.findByText('Paper A4')).toBeInTheDocument();
  });
});

describe('Trang Tháng này: thẻ việc cần làm', () => {
  it('0 người chưa đăng ký → không có thẻ; 0 món ngoài DM và tủ đủ → không có thẻ phụ', async () => {
    await open({});
    expect(screen.queryByRole('heading', { name: /chưa đăng ký kỳ tháng/ })).toBeNull();
    expect(screen.queryByRole('heading', { name: /món ngoài danh mục chờ xem/ })).toBeNull();
    expect(screen.queryByRole('heading', { name: /món trong tủ sắp hết/ })).toBeNull();
  });

  it('3 người chưa đăng ký → thẻ chính kỳ tháng 11, đủ 3 chip, không "và N người khác", nút Chép tin nhắc', async () => {
    await open({ unregistered: 3 });
    const card = (await screen.findByRole('heading', { name: '3 người chưa đăng ký kỳ tháng 11' })).closest('section')!;
    for (const n of [1, 2, 3]) expect(within(card).getByText(`Người số ${n}`)).toBeInTheDocument();
    expect(within(card).queryByText(/và \d+ người khác/)).toBeNull();
    expect(within(card).getByRole('button', { name: 'Chép tin nhắc' })).toBeEnabled();
  });

  it('chip tên tối đa 8 (hai phía): 8 người → 8 chip, không +N; 9 người → 8 chip + "và 1 người khác"', async () => {
    await open({ unregistered: 8 });
    const c8 = (await screen.findByRole('heading', { name: '8 người chưa đăng ký kỳ tháng 11' })).closest('section')!;
    expect(within(c8).getAllByRole('listitem')).toHaveLength(8);
    expect(within(c8).queryByText(/và \d+ người khác/)).toBeNull();
  });

  it('9 người chưa đăng ký → 8 chip + "và 1 người khác"', async () => {
    await open({ unregistered: 9 });
    const card = (await screen.findByRole('heading', { name: '9 người chưa đăng ký kỳ tháng 11' })).closest('section')!;
    expect(within(card).getAllByText(/^Người số \d$/)).toHaveLength(8);
    expect(within(card).getByText('và 1 người khác')).toBeInTheDocument();
    expect(within(card).queryByText('Người số 9')).toBeNull();
  });

  it('1 món ngoài danh mục → thẻ có link /admin/review; tủ có 2 món sắp hết → thẻ link /admin/stock', async () => {
    await open({ review: 1, low: [{ id: 'a', name: 'A', name_en: null, stock_qty: 1 }, { id: 'b', name: 'B', name_en: null, stock_qty: 0 }] });
    const custom = (await screen.findByRole('heading', { name: '1 món ngoài danh mục chờ xem' })).closest('section')!;
    expect(within(custom).getByRole('link', { name: 'Xem món chờ duyệt' })).toHaveAttribute('href', '/admin/review');
    const low = (await screen.findByRole('heading', { name: '2 món trong tủ sắp hết' })).closest('section')!;
    expect(within(low).getByRole('link', { name: 'Xem tủ' })).toHaveAttribute('href', '/admin/stock');
  });
});

describe('Trang Tháng này: bước Gửi ADM theo bản có hàng', () => {
  it('bản có hàng 22:12 05/11 → "Đã gửi 22:12 05/11 · 11 món, 78 đơn vị" + liên kết "Xem bản đã gửi" về Gửi ADM', async () => {
    await open({});
    const send = steps().getAllByRole('listitem')[1];
    expect(within(send).getByText('Đã gửi 22:12 05/11 · 11 món, 78 đơn vị')).toBeInTheDocument();
    expect(within(send).getByRole('link', { name: 'Xem bản đã gửi' })).toHaveAttribute('href', '/admin/send-adm');
    expect(within(send).queryByText(/bản chốt/)).toBeNull();
  });

  it('có thay đổi sau bản → "Đã gửi 22:12 05/11 · có thay đổi sau đó"', async () => {
    await open({ send: sentState({ changed_after: true, changed_at: '2026-11-06T01:00:00Z' }) });
    expect(within(steps().getAllByRole('listitem')[1]).getByText('Đã gửi 22:12 05/11 · có thay đổi sau đó')).toBeInTheDocument();
  });

  it('tháng không cần đề nghị → Gửi ADM và Hàng về xong, bước hiện tại là Giao', async () => {
    await open({ send: { ...unsentState, state: 'no_order', no_order_at: '2026-11-11T03:15:00Z', no_order_by_name: 'An' } });
    const [, send, arrive] = steps().getAllByRole('listitem');
    expect(within(send).getByText('Không cần đề nghị ADM · 10:15 11/11')).toBeInTheDocument();
    expect(within(arrive).getByText('Không có đơn gửi ADM')).toBeInTheDocument();
    expect(within(currentStep()).getByText('Giao')).toBeInTheDocument();
  });

  it('en: "Sent 22:12 05/11 · 11 items, 78 units" + "View sent order"', async () => {
    await i18n.changeLanguage('en');
    mockViewport(1280);
    setup();
    renderApp(makeMe('admin'), '/admin/home');
    const list = await screen.findByRole('list', { name: 'The 4 steps of the month' });
    const send = within(list).getAllByRole('listitem')[1];
    expect(within(send).getByText('Sent 22:12 05/11 · 11 items, 78 units')).toBeInTheDocument();
    expect(within(send).getByRole('link', { name: 'View sent order' })).toBeInTheDocument();
  });

  it('kỳ giao chưa khóa → không gọi send-state/arrivals-plan (server 409 cho kỳ mở)', async () => {
    mockViewport(1280);
    const f = setup({ locked: { is_open: true } });
    renderApp(makeMe('admin'), '/admin/home');
    await screen.findByRole('list', { name: '4 bước của tháng' });
    expect(f.mock.calls.some(([u]) => /send-state|arrivals-plan/.test(String(u)))).toBe(false);
  });
});

describe('Trang Tháng này: món ngừng dùng và thẻ lỗi', () => {
  it('món đã ngừng đã đặt còn remaining 5 vẫn chờ về: bước hiện tại là Hàng về, giá trị 5 (đã đặt thì phải nhận)', async () => {
    await open({ plan: planOf([{ remaining: 5, usable: false }]) });
    expect(within(currentStep()).getByText('Hàng về')).toBeInTheDocument();
    expect(within(currentStep()).getByText('5')).toBeInTheDocument();
  });

  it('món còn dùng remaining 5 → bước Hàng về, giá trị 5', async () => {
    await open({ plan: planOf([{ remaining: 5 }]) });
    expect(within(currentStep()).getByText('Hàng về')).toBeInTheDocument();
    expect(within(currentStep()).getByText('5')).toBeInTheDocument();
  });
  it('tải món chờ duyệt lỗi → thẻ báo lỗi có "Thử lại"; bấm → tải lại', async () => {
    mockViewport(1280);
    const f = setup({ reviewFails: true });
    renderApp(makeMe('admin'), '/admin/home');
    await screen.findByRole('list', { name: '4 bước của tháng' });
    const retry = await screen.findByRole('button', { name: 'Thử lại' });
    const calls = () => f.mock.calls.filter(([u]) => u === '/api/admin/review?status=pending').length;
    const before = calls();
    await userEvent.click(retry);
    await waitFor(() => expect(calls()).toBeGreaterThan(before));
  });

  it('tải danh sách chưa đăng ký lỗi → không chip rỗng, có "Thử lại"', async () => {
    mockViewport(1280);
    setup({ unregistered: 3, unregisteredFails: true });
    renderApp(makeMe('admin'), '/admin/home');
    const card = (await screen.findByRole('heading', { name: '3 người chưa đăng ký kỳ tháng 11' })).closest('section')!;
    expect(await within(card).findByRole('button', { name: 'Thử lại' })).toBeInTheDocument();
    expect(within(card).queryAllByRole('listitem')).toHaveLength(0);
  });
});

describe('Trang Tháng này: đường vào', () => {
  it('vào /admin → chuyển về /admin/home', async () => {
    mockViewport(1280);
    setup();
    renderApp(makeMe('admin'), '/admin');
    await screen.findByRole('heading', { level: 1, name: 'Chào Nguyễn Văn An' });
    expect(screen.getByTestId('location')).toHaveTextContent('/admin/home');
  });
});

describe('Trang Tháng này: nhắc người đã nghỉ còn phần chưa nhận (W25, R-D17.10)', () => {
  it('kỳ giao có C đã nghỉ còn phần chưa nhận → "1 người đã nghỉ còn phần chưa nhận: C" + "Xử lý" mở Tổng hợp lọc ?left=1', async () => {
    await open({ left: ['C'] });
    expect(await screen.findByText('1 người đã nghỉ còn phần chưa nhận: C')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Xử lý' })).toHaveAttribute('href', '/admin/summary?ym=2026-10&left=1');
  });

  it('D đã nghỉ chỉ còn nợ tháng trước → vẫn nhắc, "Xem nợ tháng trước" mở Còn nợ ?left=1, không có "Xử lý"', async () => {
    await open({ debt: [{ name: 'D', status: 'locked' }, { name: 'An', status: 'active' }] });
    expect(await screen.findByText('1 người đã nghỉ còn phần chưa nhận: D')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Xem nợ tháng trước' })).toHaveAttribute('href', '/admin/backlog?left=1');
    expect(screen.queryByRole('link', { name: 'Xử lý' })).toBeNull();
  });

  it('C còn phần kỳ giao và cả nợ, D chỉ nợ → đếm mỗi người một lần, đủ hai nút', async () => {
    await open({ left: ['C'], debt: [{ name: 'C', status: 'locked' }, { name: 'D', status: 'locked' }] });
    expect(await screen.findByText('2 người đã nghỉ còn phần chưa nhận: C, D')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Xử lý' })).toHaveAttribute('href', '/admin/summary?ym=2026-10&left=1');
    expect(screen.getByRole('link', { name: 'Xem nợ tháng trước' })).toHaveAttribute('href', '/admin/backlog?left=1');
  });

  it('chỉ C ở kỳ giao → không có "Xem nợ tháng trước"', async () => {
    await open({ left: ['C'] });
    await screen.findByText('1 người đã nghỉ còn phần chưa nhận: C');
    expect(screen.queryByRole('link', { name: 'Xem nợ tháng trước' })).toBeNull();
  });

  it('2 người → nối tên bằng ", "', async () => {
    await open({ left: ['C', 'Dũng'] });
    expect(await screen.findByText('2 người đã nghỉ còn phần chưa nhận: C, Dũng')).toBeInTheDocument();
  });

  it('không ai → không có dòng nhắc', async () => {
    const f = setup({});
    mockViewport(1280);
    renderApp(makeMe('admin'), '/admin/home');
    await screen.findByRole('list', { name: '4 bước của tháng' });
    await waitFor(() => expect(f.mock.calls.some(([u]) => u === LEFT_URL)).toBe(true));
    expect(screen.queryByText(/người đã nghỉ còn phần chưa nhận/)).toBeNull();
  });

  it('xem kỳ đang đăng ký → 0 cảnh báo W (Đ6)', async () => {
    await open({ left: ['C'] });
    await screen.findByText('1 người đã nghỉ còn phần chưa nhận: C');
    await userEvent.click(screen.getByRole('radio', { name: 'Kỳ đang đăng ký (tháng 11)' }));
    expect(screen.queryByText(/người đã nghỉ còn phần chưa nhận/)).toBeNull();
    expect(screen.queryByRole('link', { name: 'Xử lý' })).toBeNull();
  });

  it('kỳ giao chưa khóa → không gọi danh sách người đã nghỉ', async () => {
    mockViewport(1280);
    const f = setup({ locked: { is_open: true }, left: ['C'] });
    renderApp(makeMe('admin'), '/admin/home');
    await screen.findByRole('list', { name: '4 bước của tháng' });
    expect(f.mock.calls.some(([u]) => u === LEFT_URL)).toBe(false);
    expect(screen.queryByText(/người đã nghỉ/)).toBeNull();
  });
});
