import { afterEach, describe, expect, it } from 'vitest';
import { greetingKey } from './greeting';

const vn = (hms: string) => new Date(`2026-11-18T${hms}+07:00`);

const machineTz = process.env.TZ;
afterEach(() => {
  process.env.TZ = machineTz;
});

describe('greetingKey theo giờ Việt Nam', () => {
  it('10:59:59.999 là buổi sáng, 11:00:00.000 là buổi chiều', () => {
    expect(greetingKey(vn('10:59:59.999'))).toBe('morning');
    expect(greetingKey(vn('11:00:00.000'))).toBe('afternoon');
  });

  it('17:59:59.999 là buổi chiều, 18:00:00.000 là buổi tối', () => {
    expect(greetingKey(vn('17:59:59.999'))).toBe('afternoon');
    expect(greetingKey(vn('18:00:00.000'))).toBe('evening');
  });

  it('00:00:00.000 giờ VN là buổi sáng dù ở UTC vẫn là 17:00 ngày trước', () => {
    expect(greetingKey(new Date('2026-11-17T17:00:00.000Z'))).toBe('morning');
  });

  it('04:00:00.000 UTC là 11:00 giờ VN (chiều), 11:00:00.000 UTC là 18:00 giờ VN (tối)', () => {
    expect(greetingKey(new Date('2026-11-18T04:00:00.000Z'))).toBe('afternoon');
    expect(greetingKey(new Date('2026-11-18T11:00:00.000Z'))).toBe('evening');
  });

  it('máy đặt múi New York vẫn chào theo giờ VN: 10:59:59.999 sáng, 18:00:00.000 tối', () => {
    process.env.TZ = 'America/New_York';
    expect(greetingKey(vn('10:59:59.999'))).toBe('morning');
    expect(greetingKey(vn('18:00:00.000'))).toBe('evening');
  });
});
