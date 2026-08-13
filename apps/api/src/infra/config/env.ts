import { z } from 'zod';

/**
 * Lược đồ biến môi trường — validate & điền mặc định (fail-fast khi sai).
 * Giá trị mặc định phù hợp DEMO; môi trường thật đặt qua .env.
 */
const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  API_PORT: z.coerce.number().int().positive().default(3000),
  WEB_ORIGIN: z.string().url().default('http://localhost:8080'),
  APP_BASE_URL: z.string().url().default('http://localhost:8080'),
  DATABASE_URL: z.string().min(1).default('postgres://vpp:vpp@localhost:5433/vpp'),
  /** Issuer CÔNG KHAI — trình duyệt chuyển hướng tới đây và là `iss` trong token. */
  OIDC_ISSUER: z.string().url().default('http://localhost:9000'),
  /**
   * URL NỘI BỘ tới IdP cho các lệnh gọi server→server (token, jwks, userinfo).
   * Chỉ cần khi api không tới được `OIDC_ISSUER` bằng chính URL đó — ví dụ api chạy
   * trong Docker còn issuer là `http://localhost:9100/oidc` của trình duyệt.
   * Bỏ trống ⇒ dùng luôn `OIDC_ISSUER`.
   */
  OIDC_INTERNAL_ISSUER: z.string().default(''),
  PMH_CLIENT_ID: z.string().min(1).default('de-vpp-dev'),
  PMH_CLIENT_SECRET: z.string().min(1).default('dev-secret-change-me'),
  PMH_WEBHOOK_SECRET: z.string().min(1).default('dev-webhook-secret-change-me'),
  VPP_ADMIN_GROUP: z.string().min(1).default('VPP-Admin'),
  /** Danh sách group coi là phòng ban, phân tách bởi dấu phẩy; thứ tự = độ ưu tiên. */
  VPP_DEPARTMENT_GROUPS: z
    .string()
    .default('')
    .transform((raw) =>
      raw
        .split(',')
        .map((group) => group.trim())
        .filter((group) => group.length > 0),
    ),
  SESSION_SECRET: z.string().min(1).default('dev-session-secret-change-me'),
  SESSION_TTL_DAYS: z.coerce.number().int().positive().default(7),
  UPLOAD_DIR: z.string().min(1).default('./uploads'),
});

export type AppConfig = z.infer<typeof EnvSchema>;

/** Đọc & kiểm tra cấu hình từ biến môi trường. Ném lỗi rõ ràng nếu không hợp lệ. */
export function parseEnv(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const result = EnvSchema.safeParse(env);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Cấu hình môi trường không hợp lệ: ${issues}`);
  }
  return result.data;
}
