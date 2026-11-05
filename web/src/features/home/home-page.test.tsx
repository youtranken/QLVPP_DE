import { afterEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/lib/i18n';
import { jsonResponse, screen, userEvent, within } from '@/test/test-utils';
import { renderApp } from '@/test/render-app';
import { makeMe } from '@/test/fixtures-me';
import { mockViewport } from '@/test/viewport';
import { stubShellApi } from '@/test/admin-shell-stub';
import { reportFixture } from '@/features/reports/reports-fixtures';

const kpi = (o: object) => ({ ym: '2026-10', deadline: '2026-10-10T17:00:00.000Z', is_open: false, registered: 39, headcount: 40, headcount_source: 'snapshot', unregistered: 0, lines_pending_delivery: 4, custom_pending: 0, low_stock: 0, ...o });
const person = (i: number) => ({ sub: `u${i}`, full_name: `Người số ${i}`, email: null, department: null });
const noNeed = reportFixture({ byItem: [], custom: [] });
const needReport = reportFixture({ byItem: [{ key: 'a', item_id: 'a', name: 'Bút bi xanh', name_en: 'Blue pen', unit: 'cay', requested: 13, backlog_prev: 0, stock: 0, need: 13 }], custom: [] });

interface Setup {
  locked?: object;
  current?: object;
  snapshots?: number;
  report?: ReturnType<typeof reportFixture>;
  unregistered?: number;
  review?: number;
  low?: { id: string; name: string; name_en: string | null; stock_qty: number }[];
}

function setup(o: Setup = {}) {
  const snaps = Array.from({ length: o.snapshots ?? 1 }, (_, i) => ({ id: `s${i}`, kind: 'print', created_at: '2026-10-11T01:00:00Z', created_by_sub: 'u', created_by_name: 'x' }));
  return stubShellApi({
    '/api/admin/periods/2026-10/summary': () => jsonResponse(200, kpi(o.locked ?? {})),
    '/api/admin/periods/2026-11/summary': () => jsonResponse(200, kpi({ ym: '2026-11', is_open: true, registered: 32, unregistered: o.unregistered ?? 0, ...o.current })),
    '/api/admin/reports/2026-10/snapshots': () => jsonResponse(200, { items: snaps }),
    '/api/admin/reports/2026-10': () => jsonResponse(200, o.report ?? noNeed),
    '/api/admin/periods/2026-11/unregistered': () => jsonResponse(200, { items: Array.from({ length: o.unregistered ?? 0 }, (_, i) => person(i + 1)) }),
    '/api/admin/review?status=pending': () => jsonResponse(200, { items: Array.from({ length: o.review ?? 0 }, (_, i) => ({ line_id: `l${i}` })) }),
    '/api/admin/stock/low': () => jsonResponse(200, o.low ?? []),
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
    ['đã khóa, chưa có bản chốt', { snapshots: 0, report: needReport }, 'Gửi ADM', 'Mở Gửi ADM', '/admin/send-adm'],
    ['có bản chốt, cần mua 13', { report: needReport }, 'Hàng về', 'Nhập hàng về', '/admin/arrivals'],
    ['hàng đủ, còn 4 dòng chờ giao', {}, 'Giao', 'Mở Giao hàng', '/admin/delivery'],
  ] as const)('%s → bước hiện tại và nút dẫn đúng đường', async (_n, setupArg, step, cta, href) => {
    await open(setupArg as Setup);
    expect(within(currentStep()).getByText(step)).toBeInTheDocument();
    expect(within(currentStep()).getByRole('link', { name: cta })).toHaveAttribute('href', href);
    expect(steps().getAllByRole('link')).toHaveLength(1);
  });

  it('chuyển sang kỳ đang đăng ký: chỉ bước Đăng ký hoạt động, 3 bước sau mờ "Sau khi khóa sổ"', async () => {
    await open({});
    await userEvent.click(screen.getByRole('radio', { name: 'Kỳ đang đăng ký (tháng 11)' }));
    expect(within(currentStep()).getByText('Đăng ký')).toBeInTheDocument();
    expect(within(currentStep()).getByText('32/40')).toBeInTheDocument();
    expect(within(currentStep()).getByRole('link', { name: 'Xem tổng hợp' })).toHaveAttribute('href', '/admin/summary');
    expect(steps().getAllByText('Sau khi khóa sổ')).toHaveLength(3);
    expect(steps().getAllByRole('link')).toHaveLength(1);
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

describe('Trang Tháng này: đường vào', () => {
  it('vào /admin → chuyển về /admin/home', async () => {
    mockViewport(1280);
    setup();
    renderApp(makeMe('admin'), '/admin');
    await screen.findByRole('heading', { level: 1, name: 'Chào Nguyễn Văn An' });
    expect(screen.getByTestId('location')).toHaveTextContent('/admin/home');
  });
});
