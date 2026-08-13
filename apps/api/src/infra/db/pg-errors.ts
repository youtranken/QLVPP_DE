/** Mã lỗi Postgres cần nhận diện để đổi thành lỗi nghiệp vụ. */
const UNIQUE_VIOLATION = '23505';

interface PgErrorLike {
  code?: string;
  constraint?: string;
}

/**
 * Drizzle bọc lỗi của driver lại, nên mã lỗi Postgres nằm ở `cause` chứ không ở
 * tầng ngoài cùng — phải lần theo chuỗi `cause` mới thấy.
 */
function findPgError(error: unknown): PgErrorLike | null {
  for (let current = error; current instanceof Error; current = current.cause) {
    const candidate = current as PgErrorLike;
    if (typeof candidate.code === 'string') return candidate;
  }
  return null;
}

/**
 * Vi phạm ràng buộc unique.
 * Truyền `constraint` để chỉ bắt đúng một ràng buộc — tránh nuốt nhầm lỗi khác
 * rồi báo cho người dùng một thông điệp sai.
 */
export function isUniqueViolation(error: unknown, constraint?: string): boolean {
  const pgError = findPgError(error);
  if (pgError?.code !== UNIQUE_VIOLATION) return false;
  return constraint === undefined || pgError.constraint === constraint;
}
