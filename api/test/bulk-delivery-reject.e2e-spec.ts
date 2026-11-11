import { randomUUID } from 'node:crypto';
import { deliveryFixture } from './delivery.fixture';
import { AFTER_DEADLINE, BEFORE_DEADLINE } from './me-request.fixture';

interface Result {
  request_id: string;
  ok: boolean;
  delivered_units?: number;
  request_complete?: boolean;
  code?: string;
  line_id?: string;
}

const AUTO_NOTE = 'auto:not_approved';

// Giao kèm ghi Không mua cho món ngoài danh mục chưa duyệt mà hộp giao đã cho Hành chính thấy
describe('POST admin/deliveries/bulk: reject_line_ids', () => {
  const f = deliveryFixture('bulk-rej');
  const {
    A,
    B,
    ADMIN,
    as,
    at,
    auditOf,
    custom,
    customLine,
    deliveriesOf,
    freeze,
    http,
    review,
    save,
    stockItem,
    stockOf,
    upload,
    view,
  } = f;

  const bulk = (body: object) =>
    as(http().post('/api/admin/deliveries/bulk'), ADMIN, 'admin').send(body);
  const results = async (body: object) =>
    ((await bulk(body).expect(200)).body as { results: Result[] }).results;
  const lineOf = async (id: string) =>
    (
      await f.pool().query<{
        review_status: string;
        review_note: string | null;
        reviewed_by_sub: string | null;
      }>('SELECT review_status, review_note, reviewed_by_sub FROM request_lines WHERE id = $1', [id])
    ).rows[0];
  const reviewBells = async (id: string, sub = A) =>
    (
      await f.pool().query<{
        params: Record<string, unknown>;
      }>('SELECT params FROM in_app_notifications WHERE user_sub = $1 AND event_id = $2', [sub, `line_review:${id}`])
    ).rows;
  const deliveredBells = async (sub = A) =>
    (
      await f
        .pool()
        .query<{ one: number }>(
          "SELECT 1 AS one FROM in_app_notifications WHERE user_sub = $1 AND topic = 'request_delivered'",
          [sub],
        )
    ).rows;

  // Phiếu của A: một món danh mục (tủ 10) + một món ngoài DM còn chờ duyệt, kỳ đã khóa
  const mixed = async (name = 'Dây rút nhựa') => {
    const item = await stockItem(10);
    const img = await upload(A);
    at(BEFORE_DEADLINE);
    const r = view(
      await save([
        { item_id: item, qty: 2 },
        custom({ custom_name: name, image_file_id: img }),
      ]).expect(200),
    );
    freeze(AFTER_DEADLINE);
    const cat = r.lines.find((l) => l.item_id === item)!;
    const pending = r.lines.find((l) => !l.item_id)!;
    return { item, request: r, cat, pending };
  };

  it('giao món danh mục kèm reject_line_ids → giao đủ, món chờ thành Không mua (mã lý do), audit auto, chuông nhân viên; phiếu đủ → chuông đã giao', async () => {
    const { item, request, cat, pending } = await mixed();
    const res = await results({
      requests: [
        {
          request_id: request.id,
          lines: [{ line_id: cat.id, qty: 2, expected_delivered_qty: 0 }],
          reject_line_ids: [pending.id],
        },
      ],
    });
    expect(res[0]).toEqual({
      request_id: request.id,
      ok: true,
      delivered_units: 2,
      request_complete: true,
    });
    expect(await stockOf(item)).toBe(8);
    expect(await lineOf(pending.id)).toEqual({
      review_status: 'rejected',
      review_note: AUTO_NOTE,
      reviewed_by_sub: ADMIN,
    });
    const audits = await auditOf('line.review', pending.id);
    expect(audits).toEqual([
      expect.objectContaining({
        action: 'reject',
        auto: true,
        before: expect.objectContaining({ review_status: 'pending' }),
        after: expect.objectContaining({
          review_status: 'rejected',
          review_note: AUTO_NOTE,
        }),
      }),
    ]);
    const bells = await reviewBells(pending.id);
    expect(bells).toHaveLength(1);
    expect(bells[0].params).toMatchObject({
      action: 'rejected',
      note_code: 'not_approved',
    });
    expect(bells[0].params).not.toHaveProperty('note');
    expect(await deliveredBells()).toHaveLength(1);
  });

  it('phiếu chỉ còn dòng chưa duyệt: lines rỗng + reject_line_ids → ok 0 đơn vị, dòng thành Không mua, không chuông "đã giao"', async () => {
    const { request, line } = await customLine(A, 'Pin sạc AA');
    freeze(AFTER_DEADLINE);
    const res = await results({
      requests: [
        { request_id: request.id, lines: [], reject_line_ids: [line.id] },
      ],
    });
    expect(res[0]).toEqual({
      request_id: request.id,
      ok: true,
      delivered_units: 0,
      request_complete: false,
    });
    expect((await lineOf(line.id)).review_status).toBe('rejected');
    expect(await reviewBells(line.id)).toHaveLength(1);
    expect(await deliveredBells()).toEqual([]);
  });

  it('dòng trong reject_line_ids vừa được duyệt → PENDING_CUSTOM kèm line_id, cả phiếu rollback (không giao)', async () => {
    const { item, request, cat, pending } = await mixed('Kéo lớn');
    await review(pending.id, { action: 'accept' }).expect(200);
    const res = await results({
      requests: [
        {
          request_id: request.id,
          lines: [{ line_id: cat.id, qty: 2, expected_delivered_qty: 0 }],
          reject_line_ids: [pending.id],
        },
      ],
    });
    expect(res[0]).toMatchObject({
      ok: false,
      code: 'PENDING_CUSTOM',
      line_id: pending.id,
    });
    expect(await stockOf(item)).toBe(10);
    expect(await deliveriesOf(cat.id)).toHaveLength(0);
    expect((await lineOf(pending.id)).review_status).toBe('accepted');
  });

  it('reject_line_ids là món danh mục → PENDING_CUSTOM, không ghi gì', async () => {
    const { item, request, cat } = await mixed('Bút xoá');
    const res = await results({
      requests: [
        { request_id: request.id, lines: [], reject_line_ids: [cat.id] },
      ],
    });
    expect(res[0]).toMatchObject({
      ok: false,
      code: 'PENDING_CUSTOM',
      line_id: cat.id,
    });
    expect(await stockOf(item)).toBe(10);
    expect((await lineOf(cat.id)).review_status).toBe('n/a');
  });

  it('reject_line_ids thuộc phiếu khác → LINE_NOT_FOUND kèm line_id, dòng vẫn chờ', async () => {
    const { request, cat } = await mixed('Ghim bấm');
    const other = await customLine(B, 'Hồ dán');
    freeze(AFTER_DEADLINE);
    const res = await results({
      requests: [
        {
          request_id: request.id,
          lines: [{ line_id: cat.id, qty: 1, expected_delivered_qty: 0 }],
          reject_line_ids: [other.line.id],
        },
      ],
    });
    expect(res[0]).toMatchObject({
      ok: false,
      code: 'LINE_NOT_FOUND',
      line_id: other.line.id,
    });
    expect((await lineOf(other.line.id)).review_status).toBe('pending');
    expect(await deliveriesOf(cat.id)).toHaveLength(0);
  });

  it('giao lỗi (STALE_UPDATE) → món chờ không bị ghi Không mua', async () => {
    const { request, cat, pending } = await mixed('Thước kẻ');
    const res = await results({
      requests: [
        {
          request_id: request.id,
          lines: [{ line_id: cat.id, qty: 1, expected_delivered_qty: 1 }],
          reject_line_ids: [pending.id],
        },
      ],
    });
    expect(res[0]).toMatchObject({ ok: false, code: 'STALE_UPDATE' });
    expect((await lineOf(pending.id)).review_status).toBe('pending');
    expect(await reviewBells(pending.id)).toEqual([]);
  });

  it('kỳ chưa khóa → PERIOD_NOT_LOCKED, dòng vẫn chờ', async () => {
    const { request, line } = await customLine(A, 'Sổ tay');
    at(BEFORE_DEADLINE);
    const res = await results({
      requests: [
        { request_id: request.id, lines: [], reject_line_ids: [line.id] },
      ],
    });
    expect(res[0]).toMatchObject({ ok: false, code: 'PERIOD_NOT_LOCKED' });
    expect((await lineOf(line.id)).review_status).toBe('pending');
  });

  describe('biên đầu vào', () => {
    const invalid = async (body: object, fields: string[]) => {
      const res = await bulk(body).expect(400);
      expect(res.body).toMatchObject({ code: 'VALIDATION', fields });
    };
    const id = () => randomUUID();

    it('lines rỗng và không có reject_line_ids → 400 {requests.0.lines}', async () => {
      await invalid({ requests: [{ request_id: id(), lines: [] }] }, [
        'requests.0.lines',
      ]);
      await invalid(
        { requests: [{ request_id: id(), lines: [], reject_line_ids: [] }] },
        ['requests.0.lines'],
      );
    });

    it('reject_line_ids không phải uuid → 400; 201 phần tử → 400', async () => {
      await invalid(
        {
          requests: [{ request_id: id(), lines: [], reject_line_ids: ['x'] }],
        },
        ['requests.0.reject_line_ids'],
      );
      await invalid(
        {
          requests: [
            {
              request_id: id(),
              lines: [],
              reject_line_ids: Array.from({ length: 201 }, id),
            },
          ],
        },
        ['requests.0.reject_line_ids'],
      );
    });

    it('reject_line_ids trùng nhau hoặc trùng dòng giao → 400 {requests}', async () => {
      const a = id();
      await invalid(
        {
          requests: [{ request_id: id(), lines: [], reject_line_ids: [a, a] }],
        },
        ['requests'],
      );
      await invalid(
        {
          requests: [
            {
              request_id: id(),
              lines: [{ line_id: a, qty: 1, expected_delivered_qty: 0 }],
              reject_line_ids: [a],
            },
          ],
        },
        ['requests'],
      );
    });
  });
});
