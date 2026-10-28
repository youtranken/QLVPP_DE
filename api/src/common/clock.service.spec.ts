import { assertClockEnv, ClockService } from './clock.service';

describe('ClockService', () => {
  it('NODE_ENV=test + CLOCK_OFFSET_MS → now() lệch theo offset', () => {
    const clock = new ClockService({
      NODE_ENV: 'test',
      CLOCK_OFFSET_MS: '86400000',
    });
    expect(
      Math.abs(clock.now().getTime() - (Date.now() + 86_400_000)),
    ).toBeLessThan(1000);
  });

  it('không có biến → offset 0', () => {
    const clock = new ClockService({ NODE_ENV: 'test' });
    expect(Math.abs(clock.now().getTime() - Date.now())).toBeLessThan(1000);
  });

  it('test + CLOCK_OFFSET_MS không phải số → throw lúc khởi tạo', () => {
    expect(
      () => new ClockService({ NODE_ENV: 'test', CLOCK_OFFSET_MS: '1d' }),
    ).toThrow(/CLOCK_OFFSET_MS/);
    expect(
      () => new ClockService({ NODE_ENV: 'test', CLOCK_OFFSET_MS: 'Infinity' }),
    ).toThrow(/CLOCK_OFFSET_MS/);
    expect(
      () => new ClockService({ NODE_ENV: 'test', CLOCK_OFFSET_MS: '   ' }),
    ).toThrow(/CLOCK_OFFSET_MS/);
    expect(
      () => new ClockService({ NODE_ENV: 'test', CLOCK_OFFSET_MS: '1.5' }),
    ).toThrow(/CLOCK_OFFSET_MS/);
  });

  it('offset âm hợp lệ', () => {
    const clock = new ClockService({
      NODE_ENV: 'test',
      CLOCK_OFFSET_MS: '-60000',
    });
    expect(
      Math.abs(clock.now().getTime() - (Date.now() - 60_000)),
    ).toBeLessThan(1000);
  });

  it('test + CLOCK_OFFSET_MS rỗng → offset 0', () => {
    const clock = new ClockService({ NODE_ENV: 'test', CLOCK_OFFSET_MS: '' });
    expect(Math.abs(clock.now().getTime() - Date.now())).toBeLessThan(1000);
  });

  it('ngoài test bỏ qua offset', () => {
    const clock = new ClockService({
      NODE_ENV: 'production',
      CLOCK_OFFSET_MS: '86400000',
    });
    expect(Math.abs(clock.now().getTime() - Date.now())).toBeLessThan(1000);
  });
});

describe('assertClockEnv', () => {
  it('production có CLOCK_OFFSET_MS → throw', () => {
    expect(() =>
      assertClockEnv({ NODE_ENV: 'production', CLOCK_OFFSET_MS: '1' }),
    ).toThrow(/CLOCK_OFFSET_MS/);
  });
  it('production không có biến → ok', () => {
    expect(() => assertClockEnv({ NODE_ENV: 'production' })).not.toThrow();
  });
  it('test có biến → ok', () => {
    expect(() =>
      assertClockEnv({ NODE_ENV: 'test', CLOCK_OFFSET_MS: '1' }),
    ).not.toThrow();
  });
});
