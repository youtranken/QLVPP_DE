import { snapshotsFixture } from './report-snapshots.fixture';

const AUTO_NOTE = 'auto:not_approved';

// Chốt bản (in/Excel) hoặc "không cần đề nghị" tự ghi Không mua cho món ngoài danh mục còn chờ của kỳ
describe('Món ngoài danh mục chưa duyệt khi chốt kỳ', () => {
  const f = snapshotsFixture('pending-custom');
  const {
    ADMIN,
    A,
    B,
    build,
    create,
    customCols,
    customName,
    freeze,
    lockedLine,
    noOrder,
    pool,
    resetPeriod,
    seedLine,
    snapshot,
  } = f;

  beforeEach(async () => {
    freeze('2026-11-12T03:00:00Z');
    await resetPeriod('2026-11');
  });

  const pendingLine = (sub: string, base: string, ym = '2026-11') =>
    seedLine(ym, sub, customCols(customName(base), 2, 'pending'));
  const lineOf = async (id: string) =>
    (
      await pool().query<{
        review_status: string;
        review_note: string | null;
        reviewed_by_sub: string | null;
      }>(
        'SELECT review_status, review_note, reviewed_by_sub FROM request_lines WHERE id = $1',
        [id],
      )
    ).rows[0];
  const reviewAudits = async (id: string) =>
    (
      await pool().query<{ actor: string; detail: Record<string, unknown> }>(
        "SELECT actor, detail FROM audit_log WHERE action = 'line.review' AND object_id = $1",
        [id],
      )
    ).rows;
  const bellOf = async (id: string, sub: string) =>
    (
      await pool().query<{ params: Record<string, unknown>; link: string }>(
        'SELECT params, link FROM in_app_notifications WHERE user_sub = $1 AND event_id = $2',
        [sub, `line_review:${id}`],
      )
    ).rows;
  const pendingNow = async () => (await build('2026-11')).pending_custom_count;
  const snapshotCount = async () =>
    (
      await pool().query<{ n: number }>(
        "SELECT count(*)::int AS n FROM report_snapshots WHERE period_ym = '2026-11-01'",
      )
    ).rows[0].n;

  it('báo cáo sống liệt kê tên món chờ (live), bản chốt không mang danh sách tên', async () => {
    await lockedLine(0, 3);
    const id = await pendingLine(B, 'kep-giay');
    const live = (await build('2026-11')) as unknown as {
      pending_custom: { line_id: string; name: string }[];
      pending_custom_count: number;
    };
    // Số đếm và danh sách tên cùng một nguồn
    expect(live.pending_custom_count).toBe(live.pending_custom.length);
    expect(live.pending_custom).toContainEqual({
      line_id: id,
      name: customName('kep-giay'),
    });
    const n = await pendingNow();
    const res = await create('2026-11', {
      kind: 'print',
      reject_pending_custom: true,
      expected_pending: n,
    }).expect(201);
    const s = (await snapshot(
      (res.body as { id: string }).id,
    )) as unknown as Record<string, unknown>;
    expect(s).not.toHaveProperty('pending_custom');
    expect(s.pending_custom_count).toBe(0);
  });

  it('còn món chờ mà không gửi reject_pending_custom → 409 PENDING_CUSTOM {pending}; không bản nào, dòng vẫn chờ', async () => {
    await lockedLine(0, 3);
    const id = await pendingLine(B, 'bang-dinh');
    const n = await pendingNow();
    const res = await create('2026-11', { kind: 'xlsx' }).expect(409);
    expect(res.body).toMatchObject({ code: 'PENDING_CUSTOM', pending: n });
    expect(await snapshotCount()).toBe(0);
    expect((await lineOf(id)).review_status).toBe('pending');
  });

  it.each([
    ['ít hơn 1', -1],
    ['nhiều hơn 1', 1],
  ])(
    'biên expected_pending %s số đang chờ → 409 PENDING_CUSTOM, không ghi gì',
    async (_label, delta) => {
      await lockedLine(0, 3);
      const id = await pendingLine(B, `lech-${delta}`);
      const n = await pendingNow();
      const res = await create('2026-11', {
        kind: 'print',
        reject_pending_custom: true,
        expected_pending: n + delta,
      }).expect(409);
      expect(res.body).toMatchObject({ code: 'PENDING_CUSTOM', pending: n });
      expect(await snapshotCount()).toBe(0);
      expect((await lineOf(id)).review_status).toBe('pending');
      expect(await reviewAudits(id)).toEqual([]);
    },
  );

  it('expected_pending đúng → 201; mọi dòng chờ của kỳ thành Không mua (mã lý do), audit line.review, chuông chủ phiếu; dòng chờ kỳ khác không đụng', async () => {
    await lockedLine(0, 3);
    const a = await pendingLine(A, 'so-tay');
    const b = await pendingLine(B, 'pin-sac');
    const older = await pendingLine(B, 'ky-cu', '2026-10');
    const n = await pendingNow();
    await create('2026-11', {
      kind: 'xlsx',
      reject_pending_custom: true,
      expected_pending: n,
    }).expect(201);
    expect(await pendingNow()).toBe(0);
    for (const [id, owner] of [
      [a, A],
      [b, B],
    ]) {
      expect(await lineOf(id)).toEqual({
        review_status: 'rejected',
        review_note: AUTO_NOTE,
        reviewed_by_sub: ADMIN,
      });
      const audits = await reviewAudits(id);
      expect(audits).toHaveLength(1);
      expect(audits[0].actor).toBe(ADMIN);
      expect(audits[0].detail).toMatchObject({
        ym: '2026-11',
        action: 'reject',
        auto: true,
        before: { review_status: 'pending' },
        after: { review_status: 'rejected', review_note: AUTO_NOTE },
      });
      const bells = await bellOf(id, owner);
      expect(bells).toHaveLength(1);
      expect(bells[0].link).toBe('/history/2026-11');
      expect(bells[0].params).toMatchObject({
        ym: '2026-11',
        action: 'rejected',
        note_code: 'not_approved',
      });
      expect(bells[0].params).not.toHaveProperty('note');
    }
    expect((await lineOf(older)).review_status).toBe('pending');
  });

  it('không còn món chờ: gửi expected_pending 0 hoặc không gửi đều 201', async () => {
    await lockedLine(0, 3);
    expect(await pendingNow()).toBe(0);
    await create('2026-11', {
      kind: 'print',
      reject_pending_custom: true,
      expected_pending: 0,
    }).expect(201);
    await resetPeriod('2026-11');
    await create('2026-11', { kind: 'print' }).expect(201);
  });

  it('xem trước không ghi Không mua và không đòi cờ', async () => {
    await lockedLine(0, 3);
    const id = await pendingLine(B, 'xem-truoc');
    await f
      .as(
        f.http().post('/api/admin/reports/2026-11/snapshots/preview'),
        ADMIN,
        'admin',
      )
      .send({})
      .expect(200);
    expect((await lineOf(id)).review_status).toBe('pending');
  });

  it('lỗi sau khi từ chối (ORDER_EMPTY) → rollback, dòng vẫn chờ', async () => {
    const { item } = await lockedLine(0, 3);
    const id = await pendingLine(B, 'rong');
    const n = await pendingNow();
    const res = await create('2026-11', {
      kind: 'print',
      order_qty: { [item]: 0 },
      reject_pending_custom: true,
      expected_pending: n,
    }).expect(409);
    expect(res.body.code).toBe('ORDER_EMPTY');
    expect((await lineOf(id)).review_status).toBe('pending');
  });

  describe('Không cần đề nghị', () => {
    it('còn món chờ mà không gửi cờ → 409 PENDING_CUSTOM, chưa đặt cờ', async () => {
      const { item } = await lockedLine(0, 3);
      const id = await pendingLine(B, 'khong-can');
      const res = await noOrder('2026-11', { order_qty: { [item]: 0 } }).expect(
        409,
      );
      expect(res.body.code).toBe('PENDING_CUSTOM');
      expect((await f.sendState('2026-11')).state).toBe('unsent');
      expect((await lineOf(id)).review_status).toBe('pending');
    });

    it('cờ + expected_pending đúng → 200, dòng chờ thành Không mua; lệch → 409', async () => {
      const { item } = await lockedLine(0, 3);
      const id = await pendingLine(B, 'khong-can-2');
      const n = await pendingNow();
      await noOrder('2026-11', {
        order_qty: { [item]: 0 },
        reject_pending_custom: true,
        expected_pending: n + 1,
      }).expect(409);
      await noOrder('2026-11', {
        order_qty: { [item]: 0 },
        reject_pending_custom: true,
        expected_pending: n,
      }).expect(200);
      expect(await lineOf(id)).toMatchObject({
        review_status: 'rejected',
        review_note: AUTO_NOTE,
      });
      expect((await f.sendState('2026-11')).state).toBe('no_order');
    });
  });

  it('DTO: expected_pending âm hoặc không nguyên → 400 VALIDATION', async () => {
    for (const v of [-1, 1.5, '2']) {
      const res = await create('2026-11', {
        kind: 'print',
        reject_pending_custom: true,
        expected_pending: v,
      }).expect(400);
      expect(res.body.fields).toContain('expected_pending');
    }
  });
});
