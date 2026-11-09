import { Logger } from '@nestjs/common';
import { DirectorySyncScheduler } from './directory-sync.scheduler';

const MINUTE = 60_000;

function setup(lastAt: Date | null) {
  const config = {
    getDirectorySyncLastAt: jest.fn().mockResolvedValue(lastAt),
  };
  const directorySync = {
    sync: jest.fn().mockResolvedValue({ total: 0, created: 0, updated: 0 }),
  };
  const scheduler = new DirectorySyncScheduler(
    config as never,
    directorySync as never,
  );
  return { scheduler, config, directorySync };
}

describe('DirectorySyncScheduler — nhịp 60′ theo marker directory_sync_last_at', () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: new Date('2026-10-28T08:00:00Z') });
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('chưa có marker → bootstrap gọi sync định kỳ (marker do DirectorySyncService ghi khi thành công)', async () => {
    const { scheduler, directorySync } = setup(null);
    scheduler.onApplicationBootstrap();
    await scheduler.onModuleDestroy();
    expect(directorySync.sync).toHaveBeenCalledWith('system', 'scheduled');
  });

  it('marker 10′ trước → không gọi sync', async () => {
    const { scheduler, directorySync } = setup(
      new Date(Date.now() - 10 * MINUTE),
    );
    await scheduler.runIfDue();
    expect(directorySync.sync).not.toHaveBeenCalled();
  });

  it('marker 61′ trước → gọi sync', async () => {
    const { scheduler, directorySync } = setup(
      new Date(Date.now() - 61 * MINUTE),
    );
    await scheduler.runIfDue();
    expect(directorySync.sync).toHaveBeenCalledTimes(1);
  });

  it('sync lỗi → không ném ra ngoài', async () => {
    const { scheduler, directorySync } = setup(null);
    directorySync.sync.mockRejectedValue(new Error('PMH ID sập'));
    await expect(scheduler.runIfDue()).resolves.toBeUndefined();
  });

  it('sync lỗi → trong 5′ không dội PMH ID, tick 5′ sau thử lại', async () => {
    const { scheduler, directorySync } = setup(null);
    directorySync.sync.mockRejectedValueOnce(new Error('PMH ID sập'));
    await scheduler.tick();
    jest.setSystemTime(Date.now() + 1 * MINUTE);
    await scheduler.tick();
    expect(directorySync.sync).toHaveBeenCalledTimes(1);
    jest.setSystemTime(Date.now() + 4 * MINUTE);
    await scheduler.tick();
    expect(directorySync.sync).toHaveBeenCalledTimes(2);
  });

  it('PMH ID sập nhiều lượt → log ERROR một lần mỗi đợt sự cố; phục hồi log một dòng; sự cố mới lại ERROR', async () => {
    const error = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    const log = jest
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
    const { scheduler, directorySync } = setup(null);
    directorySync.sync.mockRejectedValue(new Error('PMH ID sập'));
    for (let i = 0; i < 4; i += 1) {
      await scheduler.tick();
      jest.setSystemTime(Date.now() + 5 * MINUTE);
    }
    expect(directorySync.sync).toHaveBeenCalledTimes(4);
    expect(error).toHaveBeenCalledTimes(1);
    directorySync.sync.mockResolvedValue({ total: 3, created: 0, updated: 0 });
    await scheduler.tick();
    expect(
      log.mock.calls.filter((c) => String(c[0]).includes('đã đồng bộ lại')),
    ).toHaveLength(1);
    jest.setSystemTime(Date.now() + 61 * MINUTE);
    directorySync.sync.mockRejectedValue(new Error('PMH ID sập lần 2'));
    await scheduler.tick();
    expect(error).toHaveBeenCalledTimes(2);
  });
});
