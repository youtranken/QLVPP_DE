import { createTransport } from 'nodemailer';

export const MAIL_TRANSPORT = Symbol('MAIL_TRANSPORT');

export interface MailMessage {
  to: string[];
  subject: string;
  text: string;
}

// Test thay bằng transport giả (test-app.helper): không bao giờ mở kết nối SMTP
export interface MailTransport {
  readonly enabled: boolean;
  send(msg: MailMessage): Promise<void>;
}

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
}

type Env = Record<string, string | undefined>;
type Log = { warn: (msg: string) => void; log: (msg: string) => void };

const trimmed = (v: string | undefined) => (v ?? '').trim();

// Cùng tên biến với QLTS; thiếu HOST hoặc FROM → tắt email (chuông trong app vẫn chạy)
export function smtpConfigFromEnv(env: Env): SmtpConfig | null {
  const host = trimmed(env.SMTP_HOST);
  const from = trimmed(env.SMTP_FROM);
  if (!host || !from) return null;
  const port = Number(trimmed(env.SMTP_PORT) || '587');
  return {
    host,
    port: Number.isInteger(port) && port > 0 ? port : 587,
    secure: trimmed(env.SMTP_SECURE) === 'true',
    user: trimmed(env.SMTP_USER),
    pass: env.SMTP_PASS ?? '',
    from,
  };
}

// Timeout hữu hạn: mặc định nodemailer (socket 10 phút) khiến SMTP treo giữ thư — và lúc tắt app — rất lâu
export function smtpTransportOptions(cfg: SmtpConfig) {
  return {
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: cfg.user ? { user: cfg.user, pass: cfg.pass } : undefined,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  };
}

// Gọi một lần lúc khởi động (factory của MailModule) → WARN "chưa cấu hình" đúng một lần
export function createSmtpTransport(env: Env, logger: Log): MailTransport {
  const cfg = smtpConfigFromEnv(env);
  if (!cfg) {
    logger.warn(
      'SMTP chưa cấu hình (thiếu SMTP_HOST hoặc SMTP_FROM) — bỏ qua email, chỉ báo trong app',
    );
    return { enabled: false, send: () => Promise.resolve() };
  }
  // createTransport không kết nối; kết nối mở khi sendMail
  const transporter = createTransport(smtpTransportOptions(cfg));
  logger.log(`Email bật qua SMTP ${cfg.host}:${cfg.port}`);
  return {
    enabled: true,
    send: async (msg) => {
      await transporter.sendMail({
        from: cfg.from,
        to: msg.to,
        subject: msg.subject,
        text: msg.text,
      });
    },
  };
}
