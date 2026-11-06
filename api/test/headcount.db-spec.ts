import { SummaryService } from '../src/modules/requests/summary.service';
import { remindersFixture } from './reminders.fixture';

// Cron khóa kỳ 2026-12 (hạn 00:00 11/12 VN) ghi tập người S cùng headcount trong một giao dịch
describe('cron khóa kỳ ghi headcount_subs (Postgres thật)', () => {
  const f = remindersFixture('hcsubs');
  const [U1, U2, U3, OUT, LATE] = ['u1', 'u2', 'u3', 'out', 'late'].map(f.sub);

  const period = async (ym: string) =>
    (
      await f.q<{ headcount: number | null; headcount_subs: string[] | null }>(
        'SELECT headcount, headcount_subs FROM periods WHERE ym = $1::date',
        [`${ym}-01`],
      )
    ).rows[0];

  beforeAll(async () => {
    for (const u of [U1, U2, U3]) await f.addUser(u, [f.GROUP]);
    await f.addUser(OUT, ['Nhom_Ngoai']);
    await f.q(
      `INSERT INTO requests (period_ym, user_sub, created_by_sub) VALUES ('2026-12-01', $1, $1), ('2026-12-01', $2, $2)`,
      [U1, OUT],
    );
  });

  it('16:59:59.999Z ngày 10/12 chưa ghi; 17:00:00.000Z ghi headcount_subs = người đủ điều kiện ∪ chủ phiếu, độ dài = headcount', async () => {
    await f.run('2026-12-10T16:59:59.999Z');
    expect(await period('2026-12')).toEqual({
      headcount: null,
      headcount_subs: null,
    });
    await f.run('2026-12-10T17:00:00.000Z');
    const p = await period('2026-12');
    expect([...p.headcount_subs!].sort()).toEqual([OUT, U1, U2, U3].sort());
    expect(p.headcount).toBe(p.headcount_subs!.length);
    expect(await f.app().get(SummaryService).people('2026-12')).toEqual({
      registered: 2,
      headcount: 4,
      unregistered: 2,
      outside: 0,
      headcount_source: 'snapshot',
    });
  });

  it('chạy lại sau khi có người mới vào nhóm → không ghi đè mảng, không đổi headcount', async () => {
    const before = await period('2026-12');
    await f.addUser(LATE, [f.GROUP]);
    await f.run('2026-12-11T05:00:00.000Z');
    await f.run('2026-12-12T05:00:00.000Z');
    expect(await period('2026-12')).toEqual(before);
    expect(
      (await f.app().get(SummaryService).people('2026-12')).headcount,
    ).toBe(4);
  });

  it('kỳ không có mảng (dữ liệu cũ chỉ có headcount, khóa trước 0116) → giữ headcount đã chụp, headcount_source snapshot', async () => {
    await f.q(
      `INSERT INTO periods (ym, deadline, headcount) VALUES ('2006-07-01', '2006-07-10T17:00:00Z', 99)
       ON CONFLICT (ym) DO NOTHING`,
    );
    f.onCleanup(() => f.q("DELETE FROM periods WHERE ym = '2006-07-01'"));
    const people = await f.app().get(SummaryService).people('2006-07');
    expect(people.headcount_source).toBe('snapshot');
    expect(people.headcount).toBe(99);
  });
});
