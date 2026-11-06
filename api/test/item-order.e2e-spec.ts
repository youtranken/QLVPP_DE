import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Pool } from 'pg';
import { snapshotsFixture } from './report-snapshots.fixture';

interface OrderFixture {
  categories: { id: string; name: string; sort_order: number }[];
  items: {
    id: string;
    code: string;
    name: string;
    sort_order: number;
    category_id: string | null;
  }[];
  expected: string[];
}

// Cùng tệp với web/src/lib/item-order.test.ts: dãy SQL và comparator TS phải trùng nhau
const FIXTURE = JSON.parse(
  readFileSync(
    join(__dirname, '../../web/src/lib/item-order.fixture.json'),
    'utf8',
  ),
) as OrderFixture;
const IDS = FIXTURE.items.map((i) => i.id);
const CATEGORY_IDS = FIXTURE.categories.map((c) => c.id);
const YM = '2026-11';

describe('Một thứ tự món chung ở mọi bề mặt (6 món, 2 nhóm + chưa nhóm, trùng số, "Ấn"/"An")', () => {
  const f = snapshotsFixture('iord');
  const { A, ADMIN, as, http } = f;
  const byCode = new Map(FIXTURE.items.map((i) => [i.code, i.id]));

  const removeFixture = async (p: Pool) => {
    await p.query('DELETE FROM request_lines WHERE item_id = ANY($1)', [IDS]);
    await p.query('DELETE FROM stock_movements WHERE item_id = ANY($1)', [IDS]);
    await p.query('DELETE FROM items WHERE id = ANY($1)', [IDS]);
    await p.query('DELETE FROM item_categories WHERE id = ANY($1)', [
      CATEGORY_IDS,
    ]);
  };
  const onlyMine = (ids: (string | null | undefined)[]) =>
    ids.filter((id): id is string => !!id && IDS.includes(id));
  const get = async <T>(path: string, sub = ADMIN, role = 'admin') =>
    (await as(http().get(path), sub, role).expect(200)).body as T;

  beforeAll(async () => {
    const p = f.pool();
    f.onCleanup(removeFixture);
    await removeFixture(p);
    await f.resetPeriod(YM);
    for (const c of FIXTURE.categories) {
      await p.query(
        'INSERT INTO item_categories (id, name, sort_order) VALUES ($1, $2, $3)',
        [c.id, c.name, c.sort_order],
      );
    }
    // Chèn ngược thứ tự mong đợi để thứ tự chèn không tình cờ trùng kết quả.
    // Tồn 4, mỗi món giữ 3 → trống 1 ≤ floor(10 × 0.2): mọi món "Sắp hết" theo phần trống
    for (const i of [...FIXTURE.items].reverse()) {
      await p.query(
        `INSERT INTO items (id, code, name, unit, max_qty, sort_order, category_id, stock_qty, restock_level)
         VALUES ($1, $2, $3, 'cay', 20, $4, $5, 4, 10)`,
        [i.id, i.code, i.name, i.sort_order, i.category_id],
      );
    }
  });

  // Fixture xóa phiếu trước mỗi ca: gieo lại dòng cho cả 6 món
  beforeEach(async () => {
    f.freeze('2026-11-12T03:00:00Z');
    for (const id of [...IDS].reverse()) {
      await f.seedLine(YM, A, { item_id: id, qty: 3 });
    }
  });

  it('GET /items (nhân viên) và GET /admin/items: đúng dãy id của fixture', async () => {
    const member = await get<{ id: string }[]>('/api/items', A, 'member');
    const admin = await get<{ id: string }[]>('/api/admin/items');
    expect(onlyMine(member.map((i) => i.id))).toEqual(FIXTURE.expected);
    expect(onlyMine(admin.map((i) => i.id))).toEqual(FIXTURE.expected);
  });

  it('Tổng hợp theo món (by=item), báo cáo byItem và tủ sắp hết: đúng dãy id', async () => {
    const summary = await get<{ items: { item_id: string | null }[] }>(
      `/api/admin/periods/${YM}/requests?by=item`,
    );
    const report = await get<{ byItem: { item_id: string }[] }>(
      `/api/admin/reports/${YM}`,
    );
    const low = await get<{ id: string }[]>('/api/admin/stock/low');
    expect(onlyMine(summary.items.map((r) => r.item_id))).toEqual(
      FIXTURE.expected,
    );
    expect(onlyMine(report.byItem.map((r) => r.item_id))).toEqual(
      FIXTURE.expected,
    );
    expect(onlyMine(low.map((r) => r.id))).toEqual(FIXTURE.expected);
  });

  it('Excel mẫu phòng (đọc lại tệp, cột Mã) và Hàng về theo bản in: đúng dãy id', async () => {
    const { id } = await f.createOk(YM, { kind: 'print' });
    const wb = await f.workbook(await f.exportXlsx(id).expect(200));
    const codes = (wb.worksheets[0].getSheetValues() as unknown[][])
      .filter((r): r is unknown[] => Array.isArray(r))
      .map((r) => r[2]);
    expect(
      onlyMine(
        codes.map((c) => (typeof c === 'string' ? byCode.get(c) : null)),
      ),
    ).toEqual(FIXTURE.expected);
    const plan = await get<{ rows: { item_id: string }[] }>(
      `/api/admin/periods/${YM}/arrivals-plan`,
    );
    expect(onlyMine(plan.rows.map((r) => r.item_id))).toEqual(FIXTURE.expected);
  });

  it('Giao hàng theo người: dòng của một người theo cùng dãy (hộp giao lấy thứ tự này)', async () => {
    const res = await get<{
      people: { user_sub: string; lines: { item_id: string | null }[] }[];
    }>(`/api/admin/periods/${YM}/delivery-people`);
    const a = res.people.find((p) => p.user_sub === A);
    expect(onlyMine(a?.lines.map((l) => l.item_id) ?? [])).toEqual(
      FIXTURE.expected,
    );
  });
});
