import type { OnModuleDestroy } from '@nestjs/common';
import type { MailMessage, MailTransport } from './mail-transport';

type Log = { warn: (msg: unknown) => void };

// Gửi sau, không chặn người gọi (webhook/sync): lỗi chỉ log mã lỗi, không log địa chỉ/nội dung/mật khẩu
export class MailOutbox implements OnModuleDestroy {
  private readonly inFlight = new Set<Promise<void>>();

  constructor(
    private readonly transport: MailTransport,
    private readonly logger: Log,
    private readonly shutdownMs = 10_000,
  ) {}

  enqueue(msg: MailMessage): void {
    if (!this.transport.enabled || msg.to.length === 0) return;
    const p = Promise.resolve()
      .then(() => this.transport.send(msg))
      .catch((error: unknown) => {
        const e = error as { code?: unknown; responseCode?: unknown };
        this.logger.warn({
          msg: 'mail_send_failed',
          code: typeof e?.code === 'string' ? e.code : null,
          response_code:
            typeof e?.responseCode === 'number' ? e.responseCode : null,
          recipients: msg.to.length,
        });
      })
      .finally(() => this.inFlight.delete(p));
    this.inFlight.add(p);
  }

  // Test chờ thư gửi xong
  async idle(): Promise<void> {
    while (this.inFlight.size > 0) await Promise.all([...this.inFlight]);
  }

  // Tắt app: chờ thư đang gửi nhưng có hạn (SMTP treo không được giữ shutdown tới lúc bị SIGKILL)
  async onModuleDestroy(): Promise<void> {
    if (this.inFlight.size === 0) return;
    let timer: NodeJS.Timeout | undefined;
    const timedOut = new Promise<boolean>((resolve) => {
      timer = setTimeout(() => resolve(true), this.shutdownMs);
    });
    const gaveUp = await Promise.race([
      this.idle().then(() => false),
      timedOut,
    ]);
    clearTimeout(timer);
    if (gaveUp) {
      this.logger.warn({
        msg: 'mail_shutdown_timeout',
        pending: this.inFlight.size,
      });
    }
  }
}
