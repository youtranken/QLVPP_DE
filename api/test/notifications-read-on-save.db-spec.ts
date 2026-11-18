import { AFTER_DEADLINE, meRequestFixture } from './me-request.fixture';

// NV-03: lưu phiếu thì chuông "chưa đăng ký tháng X" của đúng người, đúng kỳ tự đọc (Postgres thật, app thật)
describe('PUT me/request/lines — chuông nhắc chưa đăng ký tự đọc khi lưu phiếu', () => {
  const { A, B, SUFFIX, at, save, newItem, pool, onCleanup } =
    meRequestFixture('read-on-save');
  const created = '2026-11-03T01:00:00Z';

  const seedReminder = (sub: string, ym: string) =>
    pool().query(
      `INSERT INTO in_app_notifications (user_sub, event_id, topic, params, link, created_at)
       VALUES ($1, $2, 'reminder', $3::jsonb, '/', $4::timestamptz)
       ON CONFLICT (event_id, user_sub) DO UPDATE SET read_at = NULL`,
      [sub, `reminder:${ym}`, JSON.stringify({ ym }), created],
    );
  const readAt = async (sub: string, ym: string) =>
    (
      await pool().query<{ read_at: Date | null }>(
        'SELECT read_at FROM in_app_notifications WHERE user_sub = $1 AND event_id = $2',
        [sub, `reminder:${ym}`],
      )
    ).rows[0]?.read_at;

  onCleanup((p) =>
    p.query(
      "DELETE FROM in_app_notifications WHERE user_sub LIKE $1 AND event_id LIKE 'reminder:%'",
      [`e2e-req-%-${SUFFIX}`],
    ),
  );

  beforeEach(async () => {
    for (const sub of [A, B])
      for (const ym of ['2026-11', '2026-12']) await seedReminder(sub, ym);
  });

  it('A lưu phiếu kỳ 11 → chuông reminder:2026-11 của A có read_at; chuông kỳ 12 của A và chuông kỳ 11 của B vẫn chưa đọc', async () => {
    const item = await newItem();
    await save([{ item_id: item, qty: 1 }]).expect(200);
    expect(await readAt(A, '2026-11')).toBeInstanceOf(Date);
    expect(await readAt(A, '2026-12')).toBeNull();
    expect(await readAt(B, '2026-11')).toBeNull();
    expect(await readAt(B, '2026-12')).toBeNull();
  });

  it('lưu sau hạn → 409 PERIOD_LOCKED, chuông reminder:2026-11 của A giữ nguyên chưa đọc', async () => {
    const item = await newItem();
    at(AFTER_DEADLINE);
    const res = await save([{ item_id: item, qty: 1 }]).expect(409);
    expect(res.body).toMatchObject({ code: 'PERIOD_LOCKED' });
    expect(await readAt(A, '2026-11')).toBeNull();
  });

  it('chuông đã đọc từ trước giữ nguyên mốc read_at cũ (chỉ đổi chuông chưa đọc)', async () => {
    const before = new Date('2026-11-04T02:00:00.000Z');
    await pool().query(
      'UPDATE in_app_notifications SET read_at = $3 WHERE user_sub = $1 AND event_id = $2',
      [A, 'reminder:2026-11', before],
    );
    const item = await newItem();
    await save([{ item_id: item, qty: 1 }]).expect(200);
    expect((await readAt(A, '2026-11'))?.toISOString()).toBe(
      before.toISOString(),
    );
  });
});
