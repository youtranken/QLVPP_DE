import { BadRequestException } from '@nestjs/common';
import { decodeCursor, encodeCursor } from './cursor';

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
});
