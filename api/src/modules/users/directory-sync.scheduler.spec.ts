import { DirectorySyncScheduler } from './directory-sync.scheduler';

const MINUTE = 60_000;

function setup(lastAt: Date | null) {
  const config = {
    getDirectorySyncLastAt: jest.fn().mockResolvedValue(lastAt),
    setDirectorySyncLastAt: jest.fn().mockResolvedValue(undefined),
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
  });

  it('chưa có marker → bootstrap gọi sync, thành công thì ghi marker', async () => {
    const { scheduler, config, directorySync } = setup(null);
    scheduler.onApplicationBootstrap();
    await scheduler.onModuleDestroy();
    expect(directorySync.sync).toHaveBeenCalledWith('system');
    expect(config.setDirectorySyncLastAt).toHaveBeenCalledTimes(1);
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

  it('sync lỗi → không ghi marker, không ném ra ngoài', async () => {
    const { scheduler, config, directorySync } = setup(null);
    directorySync.sync.mockRejectedValue(new Error('PMH ID sập'));
    await expect(scheduler.runIfDue()).resolves.toBeUndefined();
    expect(config.setDirectorySyncLastAt).not.toHaveBeenCalled();
  });

  it('sync lỗi → trong 5′ không dội PMH ID, tick 5′ sau thử lại và ghi marker khi thành công', async () => {
    const { scheduler, config, directorySync } = setup(null);
    directorySync.sync.mockRejectedValueOnce(new Error('PMH ID sập'));
    await scheduler.tick();
    jest.setSystemTime(Date.now() + 1 * MINUTE);
    await scheduler.tick();
    expect(directorySync.sync).toHaveBeenCalledTimes(1);
    jest.setSystemTime(Date.now() + 4 * MINUTE);
    await scheduler.tick();
    expect(directorySync.sync).toHaveBeenCalledTimes(2);
    expect(config.setDirectorySyncLastAt).toHaveBeenCalledTimes(1);
  });
});
