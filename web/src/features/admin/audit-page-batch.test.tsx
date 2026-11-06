import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, screen, userEvent, within } from '@/test/test-utils';
import { renderApp } from '@/test/render-app';
import { makeMe } from '@/test/fixtures-me';
import { mockViewport } from '@/test/viewport';

const NAMES = ['Giấy A4', 'Bút bi xanh', 'Kẹp giấy', 'Bìa còng', 'Băng keo'];
const batchRow = (id: string, n: number, at: string) => ({
  id,
  actor: 'u-binh',
  actorName: 'Lê Thị Bình',
  action: 'stock.receipt',
  objectType: 'period',
  objectId: '2026-10',
  objectLabel: { name: null, ym: '2026-10', owner: null },
  detail: { lines: [], note: null },
  createdAt: at,
  batch: {
    ym: '2026-10',
    units: NAMES.slice(0, n).reduce((s, _x, i) => s + i + 1, 0),
    items: NAMES.slice(0, n).map((name, i) => ({ item_id: `i${i}`, name, name_en: `Item ${i}`, qty: i + 1 })),
  },
});
const lineRow = {
  id: 'l1',
  actor: 'u-binh',
  actorName: 'Lê Thị Bình',
  action: 'line.review',
  objectType: 'request_line',
  objectId: '0b6c1d8e-1111-4222-8333-944445555666',
  objectLabel: { name: 'Bìa lá', ym: '2026-10', owner: 'Trần Chi' },
  detail: {},
  createdAt: '2026-10-28T02:00:00.000Z',
};
const itemRow = {
  id: 'it1',
  actor: 'u-binh',
  actorName: 'Lê Thị Bình',
  action: 'stock.adjust',
  objectType: 'item',
  objectId: '7b6c1d8e-1111-4222-8333-944445555666',
  objectLabel: { name: 'Giấy note', ym: null, owner: null },
  detail: { delta: 2 },
  createdAt: '2026-10-28T01:00:00.000Z',
};

function stub(items: object[]) {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) => Promise.resolve(jsonResponse(200, url.startsWith('/api/admin/audit') ? { items, next_cursor: null } : { items: [], next_cursor: null }))),
  );
}

async function open() {
  mockViewport(1280);
  renderApp(makeMe('admin'), '/admin/audit');
  const table = await screen.findByRole('table');
  await within(table).findAllByText('Lê Thị Bình');
  return table;
}

const objectCells = (table: HTMLElement) => within(table).getAllByRole('row').map((r) => within(r).queryAllByRole('cell')[3]?.textContent ?? '');

afterEach(() => vi.unstubAllGlobals());

describe('Nhật ký — gộp một lần Lưu hàng về', () => {
  it('một lần Lưu 5 món → 1 dòng "Nhập hàng về kỳ tháng 10 — 5 món, 15 đơn vị", đối tượng "Kỳ tháng 10/2026"; mở ra thấy đủ 5 món', async () => {
    stub([batchRow('b1', 5, '2026-10-28T03:00:00.000Z')]);
    const table = await open();
    const row = within(table).getByText('Nhập hàng về kỳ tháng 10 — 5 món, 15 đơn vị').closest('tr')!;
    expect(row).toHaveTextContent('Kỳ tháng 10/2026');
    await userEvent.click(row);
    const list = screen.getByRole('list', { name: 'Các món của lần nhập' });
    expect(within(list).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Giấy A4 · 1', 'Bút bi xanh · 2', 'Kẹp giấy · 3', 'Bìa còng · 4', 'Băng keo · 5']);
  });

  it('hai lần Lưu → hai dòng gộp, mỗi dòng số món của lần đó', async () => {
    stub([batchRow('b2', 2, '2026-10-28T04:00:00.000Z'), batchRow('b1', 5, '2026-10-28T03:00:00.000Z')]);
    const table = await open();
    expect(within(table).getByText('Nhập hàng về kỳ tháng 10 — 2 món, 3 đơn vị')).toBeInTheDocument();
    expect(within(table).getByText('Nhập hàng về kỳ tháng 10 — 5 món, 15 đơn vị')).toBeInTheDocument();
  });

  it('cột đối tượng ghi tên cụ thể (tên món, phiếu của người, kỳ) — không có chuỗi request_line / item thô', async () => {
    stub([batchRow('b1', 1, '2026-10-28T03:00:00.000Z'), lineRow, itemRow]);
    const table = await open();
    const cells = objectCells(table).filter(Boolean);
    expect(cells).toEqual(['Kỳ tháng 10/2026', 'Bìa lá · Phiếu tháng 10/2026 · Trần Chi', 'Giấy note']);
    for (const c of cells) expect(c).not.toMatch(/request_line|\bitem\b/);
  });

  it('đối tượng đã bị xóa (không tra được tên) → vẫn không hiện loại thô', async () => {
    stub([{ ...lineRow, objectLabel: null }, { ...itemRow, objectLabel: null, objectType: 'mystery_type' }]);
    const table = await open();
    for (const c of objectCells(table).filter(Boolean)) expect(c).not.toMatch(/request_line|mystery_type|\bitem\b/);
  });
});
