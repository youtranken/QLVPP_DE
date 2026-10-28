import { BadRequestException } from '@nestjs/common';

export const DEFAULT_PAGE_LIMIT = 50;
export const MAX_PAGE_LIMIT = 200;

export function encodeCursor(keys: string[]): string {
  return Buffer.from(JSON.stringify(keys)).toString('base64url');
}

export function decodeCursor(raw: string, size: number): string[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'));
  } catch {
    parsed = null;
  }
  if (
    !Array.isArray(parsed) ||
    parsed.length !== size ||
    parsed.some((k) => typeof k !== 'string')
  ) {
    throw invalidCursor();
  }
  return parsed as string[];
}

export function invalidCursor(): BadRequestException {
  return new BadRequestException({
    code: 'VALIDATION',
    message: 'cursor không hợp lệ',
  });
}

const PG_TIMESTAMPTZ =
  /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})(\.\d{1,6})?[+-](\d{2})(:(\d{2}))?$/;

// Date.parse nhận cả 31/02 còn Postgres ném lỗi → 500; kiểm từng thành phần trước khi cast ::timestamptz
export function assertRealTimestamp(value: string): void {
  const m = PG_TIMESTAMPTZ.exec(value);
  if (!m) throw invalidCursor();
  const [y, mo, d, h, mi, s, offH, offM] = [1, 2, 3, 4, 5, 6, 8, 10].map((i) =>
    Number(m[i] ?? 0),
  );
  const daysInMonth = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  const ok =
    y >= 1000 &&
    mo >= 1 &&
    mo <= 12 &&
    d >= 1 &&
    d <= daysInMonth &&
    h < 24 &&
    mi < 60 &&
    s < 60 &&
    offH <= 15 &&
    offM < 60;
  if (!ok) throw invalidCursor();
}
