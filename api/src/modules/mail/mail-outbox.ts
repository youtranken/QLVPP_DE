import type { OnModuleDestroy } from '@nestjs/common';
import type { MailMessage, MailTransport } from './mail-transport';

type Log = { warn: (msg: unknown) => void };

// Gửi sau, không chặn người gọi (webhook/sync): lỗi chỉ log mã lỗi, không log địa chỉ/nội dung/mật khẩu
export class MailOutbox implements OnModuleDestroy {
  private readonly inFlight = new Set<Promise<void>>();

  constructor(
    private readonly transport: MailTransport,
    private readonly logger: Log,
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

  // Test chờ thư gửi xong; tắt app cũng chờ để không bỏ dở
  async idle(): Promise<void> {
    while (this.inFlight.size > 0) await Promise.all([...this.inFlight]);
  }

  onModuleDestroy(): Promise<void> {
    return this.idle();
  }
}
