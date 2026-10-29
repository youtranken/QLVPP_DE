export function escapeLike(input: string): string {
  return input.replace(/[\\%_]/g, '\\$&');
}

interface PgErrorLike {
  code: string;
  constraint?: string;
}

const SQLSTATE = /^[0-9A-Z]{5}$/;

// Lỗi Node (EPIPE…) cũng có `code` 5 ký tự; chỉ tin khi có dấu hiệu của DatabaseError từ pg
function isPgError(e: Record<string, unknown>): boolean {
  return (
    typeof e.code === 'string' &&
    SQLSTATE.test(e.code) &&
    (typeof e.severity === 'string' ||
      typeof e.routine === 'string' ||
      typeof e.constraint === 'string' ||
      typeof e.table === 'string')
  );
}

// drizzle bọc lỗi pg trong DrizzleQueryError.cause
function findPgError(error: unknown): PgErrorLike | null {
  for (let e = error as Record<string, unknown> | undefined; e;) {
    if (isPgError(e)) return e as unknown as PgErrorLike;
    e = e.cause as Record<string, unknown> | undefined;
  }
  return null;
}

export function pgSqlState(error: unknown): string | undefined {
  return findPgError(error)?.code;
}

export function pgViolation(
  error: unknown,
): { code: string; constraint?: string } | null {
  const e = findPgError(error);
  return e && /^\d{5}$/.test(e.code) ? e : null;
}
