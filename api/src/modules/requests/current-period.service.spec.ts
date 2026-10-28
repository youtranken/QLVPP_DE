import { PeriodsService } from '../periods/periods.service';
import { CurrentPeriodService } from './current-period.service';

// Đồng hồ giả tăng 1 ms mỗi lần đọc: lộ ra nếu một request đọc now() nhiều lần
function tickingClock(startIso: string) {
  let t = Date.parse(startIso);
  return { now: jest.fn(() => new Date(t++)) };
}

describe('CurrentPeriodService.current', () => {
  it('đọc now() đúng một lần — ở mốc 23:59:59.999 VN vẫn trả kỳ 11, còn 1 ngày', async () => {
    const clock = tickingClock('2026-11-10T16:59:59.999Z');
    const deadline = new Date('2026-11-10T17:00:00Z');
    const execute = jest
      .fn()
      // openPeriod: kỳ mở có deadline > now
      .mockResolvedValueOnce({ rows: [{ ym: '2026-11', deadline }] })
      // previous: không có phiếu kỳ 10
      .mockResolvedValueOnce({ rows: [] });
    const config = { getInt: jest.fn().mockResolvedValue(10) };
    const db = { execute } as never;
    const periods = new PeriodsService(db, clock as never, config as never);
    const service = new CurrentPeriodService(db, clock as never, periods);

    await expect(service.current('u1')).resolves.toEqual({
      ym: '2026-11',
      deadline: '2026-11-10T17:00:00.000Z',
      is_open: true,
      days_left: 1,
      previous: null,
    });
    expect(clock.now).toHaveBeenCalledTimes(1);
  });
});
