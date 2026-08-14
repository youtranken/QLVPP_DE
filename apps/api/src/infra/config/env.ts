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
  /** Client M2M cho Directory API (đồng bộ danh bạ, client_credentials). */
  PMH_M2M_CLIENT_ID: z.string().min(1).default('de-vpp-dev-m2m'),
  PMH_M2M_CLIENT_SECRET: z.string().min(1).default('dev-m2m-secret-change-me'),
  /**
   * Gốc Directory API. Bỏ trống ⇒ suy từ `OIDC_INTERNAL_ISSUER`/`OIDC_ISSUER`
   * (mock-idp phục vụ Directory ngay cạnh endpoint OIDC).
   */
  PMH_DIRECTORY_URL: z.string().default(''),
  /** Chu kỳ đồng bộ danh bạ, tính bằng phút (SSO-INTEGRATION §7 gợi ý ~60'). */
  DIRECTORY_SYNC_MINUTES: z.coerce.number().int().min(1).default(60),
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
  /**
   * Bật/tắt việc dọn ảnh mồ côi. Tắt bằng công tắc RIÊNG chứ không bằng cách đặt
   * ân hạn = 0 — đặt ân hạn 0 phải có nghĩa "không ân hạn", không phải "tắt".
   */
  UPLOAD_CLEANUP_ENABLED: z
    .enum(['true', 'false'])
    .default('true')
    .transform((value) => value === 'true'),
  /**
   * Ảnh đã tải lên nhưng chưa bản ghi nào tham chiếu chỉ bị coi là rác sau ngần
   * này giờ. Ân hạn để không xoá ảnh của form người dùng đang mở dở.
   */
  UPLOAD_ORPHAN_GRACE_HOURS: z.coerce.number().int().min(0).default(24),
  /** Chu kỳ chạy job dọn ảnh mồ côi, tính bằng giờ. */
  UPLOAD_CLEANUP_HOURS: z.coerce.number().int().min(1).default(24),
  /**
   * Tên đơn vị in trên đầu báo cáo Excel trình ký (FR-41).
   * Giá trị đặt chỗ cho tới khi có tên + logo chính thức (phụ thuộc [⏳] ở SDD §12).
   */
  ORG_NAME: z.string().min(1).default('CÔNG TY'),
});

export type AppConfig = z.infer<typeof EnvSchema>;

/**
 * Giá trị mặc định dùng cho DEV. Lên production mà còn sót cái nào là lỗi cấu
 * hình nghiêm trọng — bí mật nằm trong repo thì ai đọc repo cũng giả mạo được
 * phiên đăng nhập hoặc webhook.
 */
const DEV_ONLY_DEFAULTS: { key: keyof AppConfig; value: string }[] = [
  { key: 'PMH_CLIENT_SECRET', value: 'dev-secret-change-me' },
  { key: 'PMH_WEBHOOK_SECRET', value: 'dev-webhook-secret-change-me' },
  { key: 'PMH_M2M_CLIENT_SECRET', value: 'dev-m2m-secret-change-me' },
  { key: 'SESSION_SECRET', value: 'dev-session-secret-change-me' },
];

/** Độ dài tối thiểu cho bí mật tự sinh ở prod (32 byte hex/base64 trở lên). */
const MIN_SECRET_LENGTH = 24;

/**
 * Kiểm tra bổ sung CHỈ áp dụng cho production.
 * Thà không khởi động được còn hơn chạy với cấu hình mất an toàn mà không ai biết.
 */
function checkProductionConfig(config: AppConfig): string[] {
  const problems: string[] = [];

  for (const { key, value } of DEV_ONLY_DEFAULTS) {
    if (config[key] === value) {
      problems.push(`${key} vẫn là giá trị mặc định của dev — phải đặt bí mật riêng`);
    } else if (String(config[key]).length < MIN_SECRET_LENGTH) {
      problems.push(`${key} quá ngắn (cần ≥ ${MIN_SECRET_LENGTH} ký tự)`);
    }
  }

  // Cookie phiên đặt `secure` ở production; chạy trên http thì trình duyệt sẽ
  // bỏ cookie và người dùng không bao giờ đăng nhập được.
  if (!config.APP_BASE_URL.startsWith('https://')) {
    problems.push(`APP_BASE_URL phải là https ở production (đang là ${config.APP_BASE_URL})`);
  }
  if (!config.OIDC_ISSUER.startsWith('https://')) {
    problems.push(`OIDC_ISSUER phải là https ở production (đang là ${config.OIDC_ISSUER})`);
  }

  if (config.ORG_NAME === 'CÔNG TY') {
    problems.push('ORG_NAME vẫn là giá trị đặt chỗ — đặt tên đơn vị thật cho báo cáo Excel');
  }

  return problems;
}

/** Tập cấu hình mà các công cụ dòng lệnh (migrate, seed) thực sự cần. */
const ToolEnvSchema = EnvSchema.pick({
  DATABASE_URL: true,
  VPP_ADMIN_GROUP: true,
  VPP_DEPARTMENT_GROUPS: true,
});

export type ToolConfig = z.infer<typeof ToolEnvSchema>;

/**
 * Cấu hình cho CÔNG CỤ DÒNG LỆNH (migrate, seed).
 *
 * Chúng không đăng nhập, không gọi PMH ID, nên KHÔNG áp chốt an toàn production:
 * bắt migrate phải có `client_secret` và `APP_BASE_URL` https thì mọi lần triển
 * khai đều hỏng ở bước migrate dù cấu hình app hoàn toàn đúng.
 */
export function parseToolEnv(env: NodeJS.ProcessEnv = process.env): ToolConfig {
  const result = ToolEnvSchema.safeParse(env);
  if (!result.success) {
    throw new Error(
      `Cấu hình công cụ không hợp lệ: ${result.error.issues.map((i) => i.message).join('; ')}`,
    );
  }
  return result.data;
}

/** Đọc & kiểm tra cấu hình từ biến môi trường. Ném lỗi rõ ràng nếu không hợp lệ. */
export function parseEnv(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const result = EnvSchema.safeParse(env);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Cấu hình môi trường không hợp lệ: ${issues}`);
  }

  if (result.data.NODE_ENV === 'production') {
    const problems = checkProductionConfig(result.data);
    if (problems.length > 0) {
      const detail = `  - ${problems.join('\n  - ')}`;
      // Lối thoát cho staging nội bộ chạy http: vẫn CHẠY nhưng kêu thật to,
      // để không ai vô tình đưa cấu hình này ra thật mà tưởng là ổn.
      if (env.ALLOW_INSECURE_PRODUCTION === '1') {
        console.warn(
          `⚠️  CẢNH BÁO: production đang chạy với cấu hình KHÔNG an toàn ` +
            `(đã bật ALLOW_INSECURE_PRODUCTION):\n${detail}`,
        );
      } else {
        throw new Error(
          `Cấu hình production không an toàn:\n${detail}\n` +
            'Xem docs/operations/RUNBOOK.md để biết cách sinh và đặt các bí mật này.\n' +
            'Chỉ khi thật sự chấp nhận rủi ro (staging nội bộ) mới đặt ALLOW_INSECURE_PRODUCTION=1.',
        );
      }
    }
  }

  return result.data;
}
