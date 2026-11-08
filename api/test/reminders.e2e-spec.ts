import { DRIZZLE_DB } from '../src/database/database.module';
import type { Database } from '../src/database/database.module';
import { PeriodsService } from '../src/modules/periods/periods.service';
import { remindersFixture } from './reminders.fixture';

describe('NotificationScheduler.runHourly — kỳ mở, nhắc, kỳ khóa, dọn', () => {
  const f = remindersFixture('cal');
  const [U1, U2, U3, U4, OUT, ADMIN] = [
    'u1',
    'u2',
    'u3',
    'u4',
    'out',
    'admin',
  ].map(f.sub);
  const AUDIENCE = [U1, U2, U3];

  beforeAll(async () => {
    for (const u of AUDIENCE) await f.addUser(u, ['Khác', f.GROUP]);
    await f.addUser(OUT, ['Khác']);
    // Hành chính cùng nhóm được cấp: nhóm admin khác hoa thường vẫn bị loại khỏi mẫu số/chuông kỳ
    await f.addUser(ADMIN, [f.GROUP, f.adminGroup().toUpperCase()]);
    // U1 đã có phiếu kỳ 2026-12 → không nằm trong danh sách nhắc
    await f.q(
      `INSERT INTO requests (period_ym, user_sub, created_by_sub) VALUES ('2026-12-01', $1, $1)`,
      [U1],
    );
    // Chủ phiếu ngoài tập (người ngoài group có phiếu) → vẫn vào mẫu số chụp lúc khóa
    await f.q(
      `INSERT INTO requests (period_ym, user_sub, created_by_sub) VALUES ('2026-12-01', $1, $2)`,
      [OUT, ADMIN],
    );
  });

  it('period_open: 23:59:59.999 30/11 VN không gửi; 00:00 1/12 VN gửi period_open:2026-12 cho 3 người mẫu số, người ngoài group và Hành chính (dù cùng group) không', async () => {
    expect((await f.run('2026-11-30T16:59:59.999Z')).period_open).toBe(0);
    expect(await f.recipients('period_open:2026-12')).toEqual([]);

    expect((await f.run('2026-11-30T17:00:00Z')).period_open).toBe(3);
    const notes = await f.notes('period_open:2026-12');
    expect(notes.map((n) => n.user_sub)).toEqual(AUDIENCE);
    expect(notes[0]).toMatchObject({
      topic: 'period_open',
      params: { ym: '2026-12', deadline: '2026-12-10T17:00:00.000Z' },
      link: '/',
      created_at: new Date('2026-11-30T17:00:00Z'),
    });
  });

  it('chạy lại nhiều lần trong ngày 1 VN (00:10, 03:00, 12:00, 23:59:59.999) → vẫn 1 bản ghi mỗi người', async () => {
    for (const at of [
      '2026-11-30T17:10:00Z',
      '2026-11-30T20:00:00Z',
      '2026-12-01T05:00:00Z',
      '2026-12-01T16:59:59.999Z',
    ]) {
      expect((await f.run(at)).period_open).toBe(0);
    }
    const notes = await f.notes('period_open:2026-12');
    expect(notes.map((n) => n.user_sub)).toEqual(AUDIENCE);
    expect(
      notes.every((n) => +n.created_at === Date.parse('2026-11-30T17:00:00Z')),
    ).toBe(true);
  });

  it('api khởi động lại lúc 00:10 ngày 1 VN vẫn gửi period_open (không cần trạng thái trong process)', async () => {
    await f.q(
      "DELETE FROM in_app_notifications WHERE event_id = 'period_open:2026-12' AND user_sub = ANY($1)",
      [AUDIENCE],
    );
    await f.restart();
    expect((await f.run('2026-11-30T17:10:00Z')).period_open).toBe(3);
    expect(await f.recipients('period_open:2026-12')).toEqual(AUDIENCE);
  });

  it('ngày 2 VN (00:00 2/12) người mới vào mẫu số không nhận period_open (không gửi bù)', async () => {
    await f.addUser(U4, [f.GROUP]);
    try {
      expect((await f.run('2026-12-01T17:00:00Z')).period_open).toBe(0);
      expect(await f.recipients('period_open:2026-12')).toEqual(AUDIENCE);
    } finally {
      await f.q('DELETE FROM users WHERE sub = $1', [U4]);
    }
  });

  it('đổi registration_last_day 10 → 15 lúc 5/12; reminder: 23:59:59.999 7/12 VN không; 00:00 8/12 VN reminder:2026-12 chỉ 2 người chưa có phiếu (không Hành chính); ngày 9 không thêm', async () => {
    await f.setLastDay(15);
    expect((await f.run('2026-12-07T16:59:59.999Z')).reminder).toBe(0);
    expect(await f.recipients('reminder:2026-12')).toEqual([]);

    expect((await f.run('2026-12-07T17:00:00Z')).reminder).toBe(2);
    const notes = await f.notes('reminder:2026-12');
    expect(notes.map((n) => n.user_sub)).toEqual([U2, U3]);
    expect(notes[0]).toMatchObject({
      topic: 'reminder',
      params: { ym: '2026-12', deadline: '2026-12-10T17:00:00.000Z' },
      link: '/',
    });

    expect((await f.run('2026-12-08T17:00:00Z')).reminder).toBe(0);
    expect(await f.recipients('reminder:2026-12')).toEqual([U2, U3]);
  });

  it('period_locked (link /admin/month?ym=<kỳ>, không còn /admin/summary): hạn − 1 ms (23:59:59.999 10/12 VN) không gửi, headcount null; đúng hạn 00:00 11/12 VN → admin nhận registered 2, headcount 4 (gồm chủ phiếu ngoài tập, không đếm Hành chính); periods.headcount = 4', async () => {
    expect((await f.run('2026-12-10T16:59:59.999Z')).period_locked).toBe(0);
    expect(await f.recipients('period_locked:2026-12')).toEqual([]);
    expect(await f.headcount('2026-12')).toBeNull();

    await f.run('2026-12-10T17:00:00Z');
    const notes = await f.notes('period_locked:2026-12');
    expect(notes.map((n) => n.user_sub)).toEqual([ADMIN]);
    expect(notes[0]).toMatchObject({
      topic: 'period_locked',
      params: { ym: '2026-12', registered: 2, headcount: 4 },
      link: '/admin/month?ym=2026-12',
    });
    expect(await f.headcount('2026-12')).toBe(4);
    expect(await f.auditsSince('period.headcount_recorded', '2026-12')).toEqual(
      [{ detail: { before: null, after: 4 } }],
    );
    // Kỳ 2027-01 tạo sau khi đổi config → hạn theo 15 (BR-2)
    expect(await f.deadline('2027-01')).toBe('2027-01-15T17:00:00.000Z');

    expect((await f.run('2026-12-11T16:59:59.999Z')).period_locked).toBe(0);
    expect(await f.recipients('period_locked:2026-12')).toEqual([ADMIN]);
  });

  it('headcount chụp một lần: chạy lại cùng ngày không thêm audit; ghi lần hai (thua đua) trả số đã lưu 4, không đè, không audit', async () => {
    await f.run('2026-12-11T05:00:00Z');
    const db = f.app().get<Database>(DRIZZLE_DB);
    const persisted = await db.transaction((tx) =>
      f
        .app()
        .get(PeriodsService)
        .recordHeadcount(
          '2026-12',
          Array.from({ length: 99 }, (_, i) => `x${i}`),
          tx,
        ),
    );
    expect(persisted).toBe(4);
    expect(await f.headcount('2026-12')).toBe(4);
    expect(
      await f.auditsSince('period.headcount_recorded', '2026-12'),
    ).toHaveLength(1);
  });

  it('kỳ khóa có headcount null, lần chạy đầu tiên đã qua ngày khóa (00:00 12/12 VN) → ghi headcount bù, không gửi chuông', async () => {
    await f.q("UPDATE periods SET headcount = NULL WHERE ym = '2026-12-01'");
    await f.q(
      "DELETE FROM in_app_notifications WHERE event_id = 'period_locked:2026-12' AND user_sub = $1",
      [ADMIN],
    );
    expect((await f.run('2026-12-11T17:00:00Z')).period_locked).toBe(0);
    expect(await f.headcount('2026-12')).toBe(4);
    expect(await f.recipients('period_locked:2026-12')).toEqual([]);
  });

  it('Dec → Jan: 23:59:59.999 31/12 VN không; 00:00 1/1/2027 VN period_open:2027-01 với hạn theo config 15', async () => {
    expect((await f.run('2026-12-31T16:59:59.999Z')).period_open).toBe(0);
    expect(await f.recipients('period_open:2027-01')).toEqual([]);
    expect((await f.run('2026-12-31T17:00:00Z')).period_open).toBe(3);
    const notes = await f.notes('period_open:2027-01');
    expect(notes.map((n) => n.user_sub)).toEqual(AUDIENCE);
    expect(notes[0].params).toEqual({
      ym: '2027-01',
      deadline: '2027-01-15T17:00:00.000Z',
    });
  });

  it('kỳ 2027-01 (registration_last_day 15) không nhắc ngày 8; 23:59:59.999 12/1 VN không; 00:00 13/1 VN nhắc cả 3 người', async () => {
    expect((await f.run('2027-01-07T17:00:00Z')).reminder).toBe(0);
    expect((await f.run('2027-01-12T16:59:59.999Z')).reminder).toBe(0);
    expect(await f.recipients('reminder:2027-01')).toEqual([]);
    expect((await f.run('2027-01-12T17:00:00Z')).reminder).toBe(3);
    expect(await f.recipients('reminder:2027-01')).toEqual(AUDIENCE);
  });

  it('registration_last_day 28: kỳ 2027-02 hạn 00:00 1/3 VN, nhắc 00:00 26/2 VN (không phải 23:59:59.999 25/2)', async () => {
    await f.setLastDay(28);
    // Kỳ 2027-01 khóa 16/1 không có lần chạy nào → headcount ghi bù lúc 1/2, không chuông
    expect((await f.run('2027-01-31T17:00:00Z')).period_open).toBe(3);
    expect(await f.headcount('2027-01')).toBe(3);
    expect(await f.recipients('period_locked:2027-01')).toEqual([]);
    expect((await f.notes('period_open:2027-02'))[0].params).toEqual({
      ym: '2027-02',
      deadline: '2027-02-28T17:00:00.000Z',
    });
    expect((await f.run('2027-02-25T16:59:59.999Z')).reminder).toBe(0);
    expect((await f.run('2027-02-25T17:00:00Z')).reminder).toBe(3);
    expect(await f.recipients('reminder:2027-02')).toEqual(AUDIENCE);
  });

  it('registration_last_day 3 + nhắc 2 ngày: 00:00 1/3 VN cùng lúc khóa kỳ 2027-02 và mở kỳ 2027-03, chưa nhắc; 1 ms trước thì chưa gì; 00:00 2/3 VN nhắc', async () => {
    await f.setConfig({ registration_last_day: 3, reminder_days_left: 2 });
    const before = await f.run('2027-02-28T16:59:59.999Z');
    expect(before).toMatchObject({ period_open: 0, reminder: 0 });
    expect(await f.recipients('period_locked:2027-02')).toEqual([]);

    expect((await f.run('2027-02-28T17:00:00Z')).reminder).toBe(0);
    expect(await f.recipients('period_locked:2027-02')).toEqual([ADMIN]);
    expect(await f.headcount('2027-02')).toBe(3);
    expect(await f.deadline('2027-03')).toBe('2027-03-03T17:00:00.000Z');
    expect(await f.recipients('period_open:2027-03')).toEqual(AUDIENCE);
    expect((await f.run('2027-03-01T16:59:59.999Z')).reminder).toBe(0);
    expect((await f.run('2027-03-01T17:00:00Z')).reminder).toBe(3);
    expect(await f.recipients('reminder:2027-03')).toEqual(AUDIENCE);
  });

  it('dọn: thông báo created_at = now − 90 ngày − 1 ms bị xóa, = now − 90 ngày còn', async () => {
    const now = Date.parse('2027-03-10T03:00:00Z');
    const cutoff = now - 90 * 86_400_000;
    const seed = (key: string, at: number) =>
      f.q(
        `INSERT INTO in_app_notifications (user_sub, event_id, topic, params, created_at)
         VALUES ($1, $2, 'reminder', '{}', $3)`,
        [U1, `e2e-purge-${key}-${f.SUFFIX}`, new Date(at)],
      );
    await seed('old', cutoff - 1);
    await seed('edge', cutoff);
    expect(
      (await f.run(new Date(now).toISOString())).purged,
    ).toBeGreaterThanOrEqual(1);
    expect(await f.recipients(`e2e-purge-old-${f.SUFFIX}`)).toEqual([]);
    expect(await f.recipients(`e2e-purge-edge-${f.SUFFIX}`)).toEqual([U1]);
  });
});
