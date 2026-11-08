import { remindersFixture } from './reminders.fixture';

describe('reminder_days_left đọc từ config mỗi lần cron chạy', () => {
  const f = remindersFixture('days');
  const [U1, U2] = ['u1', 'u2'].map(f.sub);

  beforeAll(async () => {
    for (const u of [U1, U2]) await f.addUser(u);
  });

  it('reminder_days_left 5, hạn 00:00 11/12 VN: 23:59:59.999 5/12 VN không nhắc; 00:00 6/12 VN nhắc; 00:00 7/12 VN không thêm', async () => {
    await f.setConfig({ reminder_days_left: 5 });
    expect((await f.run('2026-12-05T16:59:59.999Z')).reminder).toBe(0);
    expect(await f.recipients('reminder:2026-12')).toEqual([]);
    expect((await f.run('2026-12-05T17:00:00Z')).reminder).toBe(2);
    expect(await f.recipients('reminder:2026-12')).toEqual([U1, U2]);
    expect((await f.run('2026-12-06T17:00:00Z')).reminder).toBe(0);
  });

  it('đổi reminder_days_left 5 → 3 sau khi đã nhắc: ngày còn 3 không nhắc lại (event_id theo kỳ)', async () => {
    await f.setConfig({ reminder_days_left: 3 });
    expect((await f.run('2026-12-07T17:00:00Z')).reminder).toBe(0);
    expect(await f.recipients('reminder:2026-12')).toEqual([U1, U2]);
  });
});
