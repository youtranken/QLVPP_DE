export function escapeLike(input: string): string {
  return input.replace(/[\\%_]/g, '\\$&');
}

// drizzle bọc lỗi pg trong DrizzleQueryError.cause
export function pgViolation(
  error: unknown,
): { code: string; constraint?: string } | null {
  for (let e = error as { code?: unknown; cause?: unknown } | undefined; e;) {
    if (typeof e.code === 'string' && /^\d{5}$/.test(e.code)) {
      return e as { code: string; constraint?: string };
    }
    e = e.cause as typeof e;
  }
  return null;
}
