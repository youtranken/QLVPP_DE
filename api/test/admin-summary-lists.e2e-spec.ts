import { adminSummaryFixture } from './admin-summary.fixture';

// Kỳ quá khứ riêng của suite này — không suite nào khác ghi phiếu vào 2025-07
const YM = '2025-07';

interface PersonRow {
  request_id: string;
  user_sub: string;
  full_name: string | null;
  email: string | null;
  department: string | null;
  user_status: string;
  line_count: number;
  total_qty: number;
  delivered_qty: number;
  cancelled_qty: number;
  custom_pending: number;
  updated_at: string;
}
interface ItemRow {
  key: string;
  item_id: string | null;
  name: string;
  unit: string;
  requested_qty: number;
  people: number;
}

describe('admin/periods/:ym/requests — theo người, theo món', () => {
  const f = adminSummaryFixture(YM);
  const { U1, SUFFIX, ids, asAdmin } = f;
  const TWIN = f.sub('twin');
  let r4 = '';
  const people = async (query: string) =>
    (await asAdmin(`/periods/${YM}/requests?by=person&${query}`).expect(200))
      .body as {
      items: PersonRow[];
      next_cursor: string | null;
    };
  const requestIds = async (query: string) =>
    (await people(query)).items.map((i) => i.request_id);

  beforeAll(async () => {
    // Trùng phòng ban và tên với U1 → thứ tự chỉ còn phân định bằng id
    await f.addUser(
      TWIN,
      `Bình ${SUFFIX}`,
      `twin.${SUFFIX}@pmh.test`,
      'Phòng B',
    );
    r4 = await f.newRequest(TWIN, 'Phòng B');
    await f.addLine(r4, { item_id: ids.item, qty: 1, delivered_qty: 1 });
  });

  it('by=person: sắp theo phòng ban (NULL cuối) rồi tên rồi id; số chỉ tính dòng hiệu lực', async () => {
    const page = await people('');
    expect(page.next_cursor).toBeNull();
    const twins = [ids.r1, r4].sort();
    expect(page.items.map((i) => i.request_id)).toEqual([...twins, ids.r2]);
    expect(page.items.find((i) => i.request_id === ids.r1)).toEqual({
      request_id: ids.r1,
      user_sub: U1,
      full_name: `Bình ${SUFFIX}`,
      email: `binh.${SUFFIX}@pmh.test`,
      department: 'Phòng B',
      user_status: 'active',
      line_count: 3,
      total_qty: 5,
      delivered_qty: 3,
      cancelled_qty: 2,
      custom_pending: 1,
      updated_at: expect.any(String) as string,
    });
    expect(page.items[2]).toMatchObject({
      request_id: ids.r2,
      department: null,
      line_count: 3,
      total_qty: 6,
      delivered_qty: 0,
      cancelled_qty: 0,
      custom_pending: 0,
    });
  });

  it('by=person keyset limit=1 qua hai phiếu cùng phòng ban cùng tên không trùng/sót', async () => {
    const seen: string[] = [];
    let cursor: string | null = null;
    do {
      const page = await people(
        `limit=1${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`,
      );
      expect(page.items).toHaveLength(1);
      seen.push(page.items[0].request_id);
      cursor = page.next_cursor;
    } while (cursor);
    expect(seen).toEqual([...[ids.r1, r4].sort(), ids.r2]);
  });

  it('by=person cursor hỏng → 400 VALIDATION', async () => {
    const res = await asAdmin(
      `/periods/${YM}/requests?by=person&cursor=xyz`,
    ).expect(400);
    expect(res.body).toMatchObject({ code: 'VALIDATION' });
  });

  it('cursor 1000 ký tự qua DTO (giải mã hỏng → VALIDATION "cursor không hợp lệ"); 1001 ký tự → VALIDATION {fields: [cursor]}', async () => {
    const atMax = await asAdmin(
      `/periods/${YM}/requests?by=person&cursor=${'c'.repeat(1000)}`,
    ).expect(400);
    expect(atMax.body).toMatchObject({
      code: 'VALIDATION',
      message: 'cursor không hợp lệ',
    });
    const over = await asAdmin(
      `/periods/${YM}/requests?by=person&cursor=${'c'.repeat(1001)}`,
    ).expect(400);
    expect(over.body).toMatchObject({ code: 'VALIDATION', fields: ['cursor'] });
  });

  it('q 100 ký tự → 200 (không khớp ai); 101 ký tự → 400 VALIDATION {fields: [q]}', async () => {
    expect(await requestIds(`q=${'q'.repeat(100)}`)).toEqual([]);
    const res = await asAdmin(
      `/periods/${YM}/requests?by=person&q=${'q'.repeat(101)}`,
    ).expect(400);
    expect(res.body).toMatchObject({ code: 'VALIDATION', fields: ['q'] });
  });

  it('filter=custom_pending chỉ phiếu có dòng chờ xem; pending_delivery bỏ dòng pending/rejected/đã hủy nợ', async () => {
    expect(await requestIds('filter=custom_pending')).toEqual([ids.r1]);
    expect(await requestIds('filter=pending_delivery')).toEqual([ids.r2]);
    await asAdmin(`/periods/${YM}/requests?filter=bogus`).expect(400);
  });

  it('q tìm theo tên/email; ký tự % _ là chữ thường (escapeLike)', async () => {
    expect(
      await requestIds(`q=${encodeURIComponent(`an_${SUFFIX}@`)}`),
    ).toEqual([ids.r2]);
    expect(await requestIds('q=BINH.')).toEqual([ids.r1]);
    expect(await requestIds('q=%25')).toEqual([]);
  });

  it('by=item: gộp món theo item_id, dòng ngoài DM theo tên + ĐVT đã trim/không phân biệt hoa thường', async () => {
    const res = await asAdmin(`/periods/${YM}/requests?by=item`).expect(200);
    const items = (res.body as { items: ItemRow[] }).items;
    expect(items).toHaveLength(2);
    expect(items).toEqual(
      expect.arrayContaining([
        {
          key: ids.item,
          item_id: ids.item,
          name: `e2e-sum-item-${SUFFIX}`,
          unit: 'cay',
          requested_qty: 6,
          people: 3,
        },
        {
          key: expect.any(String) as string,
          item_id: null,
          name: expect.stringMatching(/^bìa còng x$/i) as string,
          unit: expect.stringMatching(/^cai$/i) as string,
          requested_qty: 6,
          people: 2,
        },
      ]),
    );
  });

  it('phiếu 1 dòng qty 5 giao 3 hủy 2 → PersonRow {total_qty: 5, delivered_qty: 3, cancelled_qty: 2}', async () => {
    const solo = f.sub('solo');
    await f.addUser(
      solo,
      `Solo ${SUFFIX}`,
      `solo.${SUFFIX}@pmh.test`,
      'Phòng S',
    );
    const id = await f.newRequest(solo, 'Phòng S');
    try {
      await f.addLine(id, {
        item_id: ids.item,
        qty: 5,
        delivered_qty: 3,
        cancelled_qty: 2,
      });
      const row = (await people('')).items.find((i) => i.request_id === id);
      expect(row).toMatchObject({
        total_qty: 5,
        delivered_qty: 3,
        cancelled_qty: 2,
      });
    } finally {
      await f.pool().query('DELETE FROM requests WHERE id = $1', [id]);
    }
  });
});
