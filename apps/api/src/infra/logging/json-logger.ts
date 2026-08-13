import type { LoggerService, LogLevel } from '@nestjs/common';

/**
 * Log một dòng JSON mỗi bản ghi (SDD §9) để gom vào hệ thống log tập trung.
 * Cố tình giữ tối giản thay vì kéo thêm thư viện: app chỉ cần mức, thời điểm,
 * ngữ cảnh và thông điệp.
 */
/** Rút thông tin đọc được từ mọi kiểu giá trị mà Nest có thể truyền vào. */
function describe(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'string') return value;
  // Error KHÔNG serialize được bằng JSON.stringify (ra "{}"), mà đây lại đúng là
  // thứ cần nhất khi đọc log lỗi ⇒ phải rút tay message + stack.
  if (value instanceof Error) return value.stack ?? `${value.name}: ${value.message}`;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export class JsonLogger implements LoggerService {
  private write(level: LogLevel, message: unknown, context?: unknown, stack?: unknown): void {
    const line = JSON.stringify({
      time: new Date().toISOString(),
      level,
      context: typeof context === 'string' ? context : undefined,
      message: describe(message),
      detail: describe(stack),
    });
    // stderr cho lỗi, stdout cho phần còn lại — đúng quy ước của container runtime.
    if (level === 'error' || level === 'fatal') process.stderr.write(`${line}\n`);
    else process.stdout.write(`${line}\n`);
  }

  log(message: unknown, context?: unknown): void {
    this.write('log', message, context);
  }

  warn(message: unknown, context?: unknown): void {
    this.write('warn', message, context);
  }

  /** Nest gọi error(message, stack, context) — nhận cả hai thứ tự tham số. */
  error(message: unknown, stack?: unknown, context?: unknown): void {
    this.write('error', message, context ?? stack, stack);
  }

  debug(message: unknown, context?: unknown): void {
    this.write('debug', message, context);
  }

  verbose(message: unknown, context?: unknown): void {
    this.write('verbose', message, context);
  }
}
