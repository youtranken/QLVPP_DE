import { PeriodsService } from '../periods/periods.service';
import { CurrentPeriodService } from './current-period.service';

// Đồng hồ giả tăng 1 ms mỗi lần đọc: lộ ra nếu một request đọc now() nhiều lần
function tickingClock(startIso: string) {
  let t = Date.parse(startIso);
  return { now: jest.fn(() => new Date(t++)) };
}

function build(previousRows: unknown[]) {
  const clock = tickingClock('2026-11-10T16:59:59.999Z');
  const deadline = new Date('2026-11-10T17:00:00Z');
  const execute = jest
    .fn()
    // openPeriod: kỳ mở có deadline > now
    .mockResolvedValueOnce({ rows: [{ ym: '2026-11', deadline }] })
    .mockResolvedValueOnce({ rows: previousRows });
  const config = { getInt: jest.fn().mockResolvedValue(10) };
  const db = { execute } as never;
  const periods = new PeriodsService(
    db,
    clock as never,
    config as never,
    {} as never,
  );
  const service = new CurrentPeriodService(db, clock as never, periods);
  return { service, clock, execute };
}

const PERIOD_NOV = {
  ym: '2026-11',
  deadline: '2026-11-10T17:00:00.000Z',
  is_open: true,
  days_left: 1,
};

describe('CurrentPeriodService.get', () => {
  it('đọc now() đúng một lần — ở mốc 23:59:59.999 VN vẫn trả kỳ 11, còn 1 ngày', async () => {
    const { service, clock } = build([]);

    await expect(service.get('u1', 'member')).resolves.toEqual({
      ...PERIOD_NOV,
      previous: null,
    });
    expect(clock.now).toHaveBeenCalledTimes(1);
  });

  it('member có phiếu kỳ trước còn nợ → previous.delivering true', async () => {
    const { service } = build([{ delivering: true }]);

    await expect(service.get('u1', 'member')).resolves.toMatchObject({
      previous: { ym: '2026-10', delivering: true },
    });
  });

  it.each(['admin', 'sa'])(
    '%s → previous null, không tra phiếu của người gọi',
    async (role) => {
      const { service, execute } = build([{ delivering: true }]);

      await expect(service.get('u1', role)).resolves.toEqual({
        ...PERIOD_NOV,
        previous: null,
      });
      expect(execute).toHaveBeenCalledTimes(1);
    },
  );
});
