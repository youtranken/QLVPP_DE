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
  DATABASE_URL: z.string().min(1).default('postgres://vpp:vpp@localhost:5432/vpp'),
  OIDC_ISSUER: z.string().url().default('http://localhost:9000'),
  PMH_CLIENT_ID: z.string().min(1).default('de-vpp-dev'),
  PMH_CLIENT_SECRET: z.string().min(1).default('dev-secret-change-me'),
  PMH_WEBHOOK_SECRET: z.string().min(1).default('dev-webhook-secret-change-me'),
  VPP_ADMIN_GROUP: z.string().min(1).default('VPP-Admin'),
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
