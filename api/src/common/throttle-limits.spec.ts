import { throttlePerMin } from './throttle-limits';

describe('throttlePerMin', () => {
  it.each(['THROTTLE_USER_PER_MIN', 'THROTTLE_IP_PER_MIN'] as const)(
    '%s không đặt hoặc rỗng → mặc định 300',
    (name) => {
      expect(throttlePerMin({}, name)).toBe(300);
      expect(throttlePerMin({ [name]: '' }, name)).toBe(300);
    },
  );

  it.each(['1', '5', '300', '100000'])('"%s" → số đó', (raw) => {
    expect(
      throttlePerMin({ THROTTLE_USER_PER_MIN: raw }, 'THROTTLE_USER_PER_MIN'),
    ).toBe(Number(raw));
  });

  it.each(['-1', '0', '300/min', '1.5', 'abc', ' 300', '100001', '1e3'])(
    '"%s" → từ chối khởi động, thông báo nêu tên biến',
    (raw) => {
      expect(() =>
        throttlePerMin({ THROTTLE_IP_PER_MIN: raw }, 'THROTTLE_IP_PER_MIN'),
      ).toThrow(/THROTTLE_IP_PER_MIN phải là số nguyên 1–100000/);
    },
  );
});
