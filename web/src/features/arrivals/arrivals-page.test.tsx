import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, screen, userEvent, waitFor } from '@/test/test-utils';
import { renderApp } from '@/test/render-app';
import { makeMe } from '@/test/fixtures-me';
import { mockViewport } from '@/test/viewport';
import { stubShellApi } from '@/test/admin-shell-stub';
import i18n from '@/lib/i18n';
import type { MonthReport } from '@/features/reports/reports.api';

const REPORT_URL = '/api/admin/reports/2026-10';
const RECEIPT_URL = '/api/admin/stock/receipts';
const PAST = { deadline: '2026-10-10T17:00:00.000Z' };
const FUTURE = { deadline: '2999-10-10T17:00:00.000Z' };

const rep = (over: Partial<MonthReport['byItem'][number]>[], custom: MonthReport['custom'] = []): MonthReport => ({
  ym: '2026-10',
  byItem: over.map((o, i) => ({ key: `k${i}`, item_id: `i-${i}`, code: `C${i}`, name: `Món ${i}`, name_en: null, unit: 'cay', requested: 0, backlog_prev: 0, stock: 0, need: 0, ...o })),
  custom,
  byDepartment: [],
  issues: [],
  pending_custom_count: 0,
});
const item = (id: string, name: string, stock: number, active = true) => ({ id, name, name_en: `${name} EN`, unit: 'cay', image_file_id: null, stock_qty: stock, active });
const ITEMS = [item('i-0', 'Món 0', 2), item('i-1', 'Món 1', 0), item('i-9', 'Món thêm', 4), item('i-off', 'Món ngừng', 1, false)];
const REPORT = rep([{ requested: 8, need: 6, stock: 2 }, { requested: 10, need: 10 }]);

interface Stub {
  report?: MonthReport;
  summary?: { deadline: string };
  receipt?: (body: unknown) => Response;
  items?: () => unknown[];
}

function stub(s: Stub = {}) {
  return stubShellApi({
    '/api/admin/periods/2026-10/summary': () => jsonResponse(200, { lines_pending_delivery: 0, ...(s.summary ?? PAST) }),
    [REPORT_URL]: () => jsonResponse(200, s.report ?? REPORT),
    '/api/admin/items': () => jsonResponse(200, s.items?.() ?? ITEMS),
    [RECEIPT_URL]: (init) => (s.receipt ?? (() => jsonResponse(200, { items: [] })))(JSON.parse(String(init?.body))),
  });
}

const sent = (f: ReturnType<typeof stub>) => f.mock.calls.filter(([u]) => u === RECEIPT_URL).map(([, init]) => JSON.parse(String((init as RequestInit).body)));
const calls = (f: ReturnType<typeof stub>, url: string) => f.mock.calls.filter(([u]) => u === url).length;
const box = (name: string) => screen.getByRole('spinbutton', { name: `Về lần này: ${name}` }) as HTMLInputElement;
const type = async (name: string, text: string) => {
  const el = box(name);
  await userEvent.clear(el);
  if (text) await userEvent.type(el, text);
};
const save = () => screen.getByRole('button', { name: 'Lưu hàng về' });

function open(width = 1280) {
  mockViewport(width);
  renderApp(makeMe('admin'), '/admin/arrivals');
  return screen.findByRole('heading', { level: 1, name: 'Hàng về kỳ tháng 10' });
}

afterEach(() => vi.unstubAllGlobals());

describe('ArrivalsPage — hiển thị', () => {
  it('điền sẵn Cần mua, nhãn Đủ, tủ sau khi lưu = tủ + về, 3 ô số', async () => {
    stub();
    await open();
    expect(await screen.findByDisplayValue('6')).toBe(box('Món 0'));
    expect(box('Món 1')).toHaveValue(10);
    expect(screen.getAllByText('Đủ', { selector: '.tag' })).toHaveLength(2);
    expect(screen.getByRole('row', { name: /Món 0/ })).toHaveTextContent('8');
    expect(screen.getByRole('row', { name: /Món 0/ })).toHaveTextContent('2');
    expect(screen.getByText('Món cần nhập').parentElement).toHaveTextContent('2');
    expect(screen.getByText('Tổng đơn vị về').parentElement).toHaveTextContent('16');
    expect(screen.getByText('Món đã đủ').parentElement).toHaveTextContent('2');
  });

  it('sửa 10 → nhãn Thiếu, 99 → Dư, tủ sau khi lưu đổi theo', async () => {
    stub();
    await open();
    await screen.findByDisplayValue('6');
    await type('Món 1', '7');
    expect(screen.getByRole('row', { name: /Món 1/ })).toHaveTextContent('Thiếu');
    await type('Món 1', '12');
    expect(screen.getByRole('row', { name: /Món 1/ })).toHaveTextContent('Dư');
    expect(screen.getByRole('row', { name: /Món 1/ })).toHaveTextContent('12');
  });

  it('món ngoài danh mục: dòng ghi chú, không có ô nhập', async () => {
    stub({ report: rep([{ requested: 1, need: 1 }], [{ key: 'c', name: 'Tập', unit: 'cai', requested: 2, backlog_prev: 0, stock: null, need: 2, people: 1 }]) });
    await open();
    expect(await screen.findByText('1 món ngoài danh mục giao thẳng, không qua tủ')).toBeInTheDocument();
    expect(screen.getAllByRole('spinbutton')).toHaveLength(1);
  });
});

describe('ArrivalsPage — lưu', () => {
  it('gửi đúng body: expected_stock_qty = tủ hiện tại, bỏ dòng qty 0, ghi chú, ym kỳ khóa', async () => {
    const f = stub();
    await open();
    await screen.findByDisplayValue('6');
    await type('Món 1', '0');
    await userEvent.type(screen.getByRole('textbox', { name: 'Ghi chú đợt (không bắt buộc)' }), 'đợt 2');
    await userEvent.click(save());
    await waitFor(() => expect(sent(f)).toHaveLength(1));
    expect(sent(f)[0]).toEqual({ lines: [{ item_id: 'i-0', qty: 6, expected_stock_qty: 2 }], ym: '2026-10', note: 'đợt 2' });
  });

  it('thành công: dải xanh "Đã nhập 1 món vào tủ" + link Giao hàng, tải lại báo cáo và tủ', async () => {
    const f = stub({ receipt: () => jsonResponse(200, { items: [{ item_id: 'i-0', stock_qty: 8, movement_id: 'm' }] }) });
    await open();
    await screen.findByDisplayValue('6');
    await type('Món 1', '0');
    const before = [calls(f, REPORT_URL), calls(f, '/api/admin/items')];
    await userEvent.click(save());
    const banner = (await screen.findByText('Đã nhập 1 món vào tủ.')).closest('[role="status"]') as HTMLElement;
    expect(banner).toHaveTextContent('Đã nhập 1 món vào tủ. Tiếp theo: Giao hàng');
    expect(banner.querySelector('a')).toHaveAttribute('href', '/admin/delivery');
    await waitFor(() => expect(calls(f, REPORT_URL)).toBeGreaterThan(before[0]));
    expect(calls(f, '/api/admin/items')).toBeGreaterThan(before[1]);
  });

  it('sau khi lưu: dòng ở lại nhưng mọi số về = 0, Tổng đơn vị về 0, không lưu lần hai được; "Nhập đợt tiếp" điền lại số gợi ý', async () => {
    const f = stub({ receipt: () => jsonResponse(200, { items: [] }) });
    await open();
    await screen.findByDisplayValue('6');
    await userEvent.click(save());
    await screen.findByText('Đã nhập 2 món vào tủ.');
    expect(box('Món 0')).toHaveValue(0);
    expect(box('Món 1')).toHaveValue(0);
    expect(screen.getByText('Tổng đơn vị về').parentElement).toHaveTextContent('0');
    expect(save()).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Nhập đợt tiếp' }));
    expect(box('Món 0')).toHaveValue(6);
    expect(box('Món 1')).toHaveValue(10);
    expect(screen.getByText('Tổng đơn vị về').parentElement).toHaveTextContent('16');
    expect(save()).toBeEnabled();
    expect(sent(f)).toHaveLength(1);
  });

  it('409 STALE_UPDATE: báo "Tủ vừa thay đổi…", tải lại tủ, giữ số đã gõ', async () => {
    const f = stub({ receipt: () => jsonResponse(409, { code: 'STALE_UPDATE', item_id: 'i-0', stock_qty: 5 }) });
    await open();
    await screen.findByDisplayValue('6');
    await type('Món 1', '3');
    const before = calls(f, '/api/admin/items');
    await userEvent.click(save());
    expect(await screen.findByRole('alert')).toHaveTextContent('Tủ vừa thay đổi, kiểm lại số rồi lưu lại');
    await waitFor(() => expect(calls(f, '/api/admin/items')).toBeGreaterThan(before));
    expect(box('Món 1')).toHaveValue(3);
    expect(screen.queryByText('Đã nhập 1 món vào tủ.')).not.toBeInTheDocument();
  });

  it('mọi qty = 0 → nút Lưu vô hiệu', async () => {
    stub();
    await open();
    await screen.findByDisplayValue('6');
    await type('Món 0', '0');
    expect(save()).toBeEnabled();
    await type('Món 1', '0');
    expect(save()).toBeDisabled();
  });

  it('kỳ chưa khóa: thông báo, không bảng, không nút Lưu', async () => {
    stub({ summary: FUTURE });
    await open();
    expect(await screen.findByText('Kỳ tháng 10 chưa khóa sổ, mở lại sau 11/10.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Lưu hàng về' })).not.toBeInTheDocument();
  });
});

describe('ArrivalsPage — biên ô Về lần này', () => {
  it('0 được (dòng bị bỏ qua, không lỗi)', async () => {
    stub();
    await open();
    await screen.findByDisplayValue('6');
    await type('Món 0', '0');
    expect(box('Món 0')).not.toHaveAttribute('aria-invalid', 'true');
    expect(save()).toBeEnabled();
  });

  it('-1 báo lỗi gắn ô (aria-describedby), nút Lưu vô hiệu', async () => {
    stub();
    await open();
    await screen.findByDisplayValue('6');
    await type('Món 0', '-1');
    const el = box('Món 0');
    expect(el).toHaveAttribute('aria-invalid', 'true');
    expect(document.getElementById(el.getAttribute('aria-describedby') ?? '')).toHaveTextContent('Nhập số nguyên từ 0 trở lên');
    expect(save()).toBeDisabled();
  });

  it('99999 được; 100000 báo "Tối đa 99.999" và vô hiệu Lưu', async () => {
    stub();
    await open();
    await screen.findByDisplayValue('6');
    await type('Món 0', '99999');
    expect(box('Món 0')).not.toHaveAttribute('aria-invalid', 'true');
    expect(save()).toBeEnabled();
    await type('Món 0', '100000');
    expect(document.getElementById(box('Món 0').getAttribute('aria-describedby') ?? '')).toHaveTextContent('Tối đa 99.999');
    expect(save()).toBeDisabled();
  });
});

describe('ArrivalsPage — món đã ngừng và tên tiếng Anh', () => {
  const withOff = rep([{ requested: 8, need: 6, stock: 2 }, { item_id: 'i-off', name: 'Món ngừng', requested: 3, need: 3 }]);

  it('món inactive không có ô nhập, có dòng ghi chú, lưu không gửi món đó', async () => {
    const f = stub({ report: withOff });
    await open();
    await screen.findByDisplayValue('6');
    expect(screen.queryByRole('spinbutton', { name: 'Về lần này: Món ngừng' })).not.toBeInTheDocument();
    expect(screen.getByText('1 món đã ngừng dùng, không nhập kho')).toBeInTheDocument();
    await userEvent.click(save());
    await waitFor(() => expect(sent(f)).toHaveLength(1));
    expect(sent(f)[0].lines).toEqual([{ item_id: 'i-0', qty: 6, expected_stock_qty: 2 }]);
  });

  it('404 ITEM_NOT_FOUND: báo tên món, không báo lỗi chung', async () => {
    stub({ receipt: () => jsonResponse(404, { code: 'ITEM_NOT_FOUND', item_id: 'i-0' }) });
    await open();
    await screen.findByDisplayValue('6');
    await userEvent.click(save());
    expect(await screen.findByRole('alert')).toHaveTextContent('Món 0');
    expect(screen.getByRole('alert')).not.toHaveTextContent('Chưa lưu được');
  });

  it('giao diện tiếng Anh: bảng và danh sách Thêm món khác dùng name_en', async () => {
    stub();
    await i18n.changeLanguage('en');
    try {
      mockViewport(1280);
      renderApp(makeMe('admin'), '/admin/arrivals');
      expect(await screen.findByRole('spinbutton', { name: 'Arriving now: Món 0 EN' })).toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: 'Add another item' }));
      const options = Array.from(screen.getByRole('combobox', { name: 'Choose item' }).querySelectorAll('option')).map((o) => o.textContent);
      expect(options).toContain('Món thêm EN');
    } finally {
      await i18n.changeLanguage('vi');
    }
  });
});

describe('ArrivalsPage — Thêm món khác', () => {
  it('chỉ món đang dùng, chưa có trong bảng; qty mặc định 1; gửi cùng dòng đã có', async () => {
    const f = stub();
    await open();
    await screen.findByDisplayValue('6');
    await userEvent.click(screen.getByRole('button', { name: 'Thêm món khác' }));
    const select = screen.getByRole('combobox', { name: 'Chọn món' });
    const options = Array.from(select.querySelectorAll('option')).map((o) => o.textContent);
    expect(options).toContain('Món thêm');
    expect(options).not.toContain('Món ngừng');
    expect(options).not.toContain('Món 0');
    await userEvent.selectOptions(select, 'i-9');
    await userEvent.click(screen.getByRole('button', { name: 'Thêm vào bảng' }));
    expect(box('Món thêm')).toHaveValue(1);
    await type('Món 0', '0');
    await type('Món 1', '0');
    await userEvent.click(save());
    await waitFor(() => expect(sent(f)).toHaveLength(1));
    expect(sent(f)[0].lines).toEqual([{ item_id: 'i-9', qty: 1, expected_stock_qty: 4 }]);
  });

  it('món vừa thêm rồi xuất hiện trong báo cáo sau khi tải lại: chỉ một dòng, gửi không trùng item_id', async () => {
    let reported = false;
    const f = stub({
      receipt: () => {
        reported = true;
        return jsonResponse(409, { code: 'STALE_UPDATE', item_id: 'i-0', stock_qty: 2 });
      },
    });
    const base = f.getMockImplementation()!;
    f.mockImplementation(async (url: string, init?: RequestInit) =>
      url === REPORT_URL && reported ? jsonResponse(200, rep([{ requested: 8, need: 6, stock: 2 }, { requested: 10, need: 10 }, { requested: 3, need: 3 }].map((o, i) => (i === 2 ? { ...o, item_id: 'i-9', name: 'Món thêm' } : o)))) : base(url, init),
    );
    await open();
    await screen.findByDisplayValue('6');
    await userEvent.click(screen.getByRole('button', { name: 'Thêm món khác' }));
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Chọn món' }), 'i-9');
    await userEvent.click(screen.getByRole('button', { name: 'Thêm vào bảng' }));
    await userEvent.click(save());
    await screen.findByRole('alert');
    await waitFor(() => expect(screen.getAllByRole('spinbutton', { name: 'Về lần này: Món thêm' })).toHaveLength(1));
    f.mockImplementation(base);
    await userEvent.click(save());
    await waitFor(() => expect(sent(f)).toHaveLength(2));
    const ids = (sent(f)[1].lines as { item_id: string }[]).map((l) => l.item_id);
    expect(ids.filter((i) => i === 'i-9')).toHaveLength(1);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
