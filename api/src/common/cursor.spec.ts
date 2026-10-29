import { BadRequestException } from '@nestjs/common';
import {
  assertRealTimestamp,
  decodeCursor,
  decodeTimestampCursor,
  encodeCursor,
} from './cursor';

describe('cursor phân trang keyset', () => {
  it('encode rồi decode trả lại đúng các khóa', () => {
    const raw = encodeCursor(['Nguyễn Văn A', 'sub-1']);
    expect(decodeCursor(raw, 2)).toEqual(['Nguyễn Văn A', 'sub-1']);
  });

  it.each(['khong-phai-base64!', encodeCursor(['chi-mot']), 'e30'])(
    'cursor hỏng hoặc sai số khóa (%p) → 400 VALIDATION',
    (raw) => {
      expect(() => decodeCursor(raw, 2)).toThrow(BadRequestException);
      expect(() => decodeCursor(raw, 2)).toThrow(
        expect.objectContaining({
          response: expect.objectContaining({ code: 'VALIDATION' }) as unknown,
        }) as Error,
      );
    },
  );

  it.each([
    '2028-02-29 00:00:00+07',
    '2000-01-01 00:00:00+07',
    '2026-10-28 10:00:00.123456+07:30',
    '2026-10-28 10:00:00-05',
  ])('assertRealTimestamp nhận %p', (ts) => {
    expect(() => assertRealTimestamp(ts)).not.toThrow();
  });

  it.each([
    '2027-02-29 00:00:00+07',
    '2026-99-99 00:00:00+07',
    '2026-10-28 10:00:00+07:99',
    '0999-10-28 10:00:00+07',
    '1999-12-31 23:59:59+07',
    '2026-10-28T10:00:00+07',
    'rac',
  ])('assertRealTimestamp từ chối %p → 400 VALIDATION', (ts) => {
    expect(() => assertRealTimestamp(ts)).toThrow(BadRequestException);
  });

  it('decodeTimestampCursor: (timestamptz, uuid) hợp lệ → trả lại; uuid sai hoặc ngày không có → VALIDATION', () => {
    const ts = '2026-11-05 10:00:00.123456+07';
    const id = '0b7e6f1a-1c2d-4e5f-8a9b-0c1d2e3f4a5b';
    expect(decodeTimestampCursor(encodeCursor([ts, id]))).toEqual([ts, id]);
    for (const bad of [
      [ts, 'khong-phai-uuid'],
      ['2026-02-31 10:00:00+07', id],
    ]) {
      expect(() => decodeTimestampCursor(encodeCursor(bad))).toThrow(
        BadRequestException,
      );
    }
  });
});
