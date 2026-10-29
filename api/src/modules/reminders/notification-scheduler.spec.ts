import { NotificationScheduler } from './notification-scheduler';

type Ctor = ConstructorParameters<typeof NotificationScheduler>;

function scheduler(
  openPeriod: () => Promise<unknown>,
  summary: Record<string, unknown> = {},
) {
  const tx = { execute: jest.fn() };
  const db = { transaction: (fn: (t: unknown) => unknown) => fn(tx) };
  const periods = {
    openPeriod: jest.fn(openPeriod),
    latestLocked: jest.fn().mockResolvedValue(null),
  };
  const notifications = {
    adminRecipients: jest.fn().mockResolvedValue(['admin']),
    notifyWithin: jest.fn().mockResolvedValue(1),
    purgeBefore: jest.fn().mockResolvedValue(4),
  };
  const stock = {
    claimLowStockWithin: jest.fn().mockResolvedValue([
      {
        id: 'i',
        name: 'Bút',
        name_en: null,
        stock_qty: 1,
        last_purchase_id: null,
      },
    ]),
  };
  const s = new NotificationScheduler(
    db as unknown as Ctor[0],
    { now: () => new Date('2026-12-05T03:00:00Z') } as Ctor[1],
    periods as unknown as Ctor[2],
    summary as unknown as Ctor[3],
    notifications as unknown as Ctor[4],
    stock as unknown as Ctor[5],
    { getBool: () => Promise.resolve(true) } as unknown as Ctor[6],
  );
  return { s, periods, notifications };
}

describe('NotificationScheduler', () => {
  it('một bước lỗi (đọc kỳ mở hỏng) không làm sập cron: các bước sau vẫn chạy, bước lỗi trả 0', async () => {
    const { s, notifications } = scheduler(() =>
      Promise.reject(new Error('db down')),
    );
    await expect(
      s.runHourly(new Date('2026-12-05T03:00:00Z')),
    ).resolves.toEqual({
      period_open: 0,
      reminder: 0,
      period_locked: 0,
      low_stock: 1,
      purged: 4,
    });
    // 90 ngày trước mốc truyền vào, không phải đồng hồ máy
    expect(notifications.purgeBefore).toHaveBeenCalledWith(
      new Date('2026-09-06T03:00:00Z'),
    );
  });

  it('NODE_ENV=test: khởi động và nhịp cron không tự chạy (e2e gọi runHourly với mốc cố định)', async () => {
    const { s, periods } = scheduler(() => Promise.resolve(null));
    s.onApplicationBootstrap();
    await s.tick();
    expect(periods.openPeriod).not.toHaveBeenCalled();
  });

  it('period_open lỗi (đọc mẫu số hỏng) không làm mất reminder cùng ngày (lastDay 3: ngày 1 vừa mở vừa nhắc)', async () => {
    const { s } = scheduler(
      () =>
        Promise.resolve({
          ym: '2027-03',
          deadline: new Date('2027-03-03T17:00:00Z'),
        }),
      {
        audienceSubs: () => Promise.reject(new Error('db down')),
        unregisteredSubs: () => Promise.resolve(['u']),
      },
    );
    await expect(
      s.runHourly(new Date('2027-02-28T17:00:00Z')), // 00:00 1/3 VN
    ).resolves.toMatchObject({ period_open: 0, reminder: 1 });
  });
});
