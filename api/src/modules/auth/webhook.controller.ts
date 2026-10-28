import {
  BadRequestException,
  Controller,
  Headers,
  HttpCode,
  Inject,
  Logger,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { sql } from 'drizzle-orm';
import type { Request } from 'express';
import { DRIZZLE_DB } from '../../database/database.module';
import type { Database } from '../../database/database.module';
import { AuditWriterService } from '../audit/audit-writer.service';
import { UsersService } from '../users/users.service';
import { Public } from './public.decorator';
import { SessionService } from './session.service';

interface PmhWebhookEvent {
  type: string;
  user_id: string;
  groups?: string[];
  event_id?: string;
}

const KICK_EVENTS = new Set([
  'user.locked',
  'user.deleted',
  'user.password_changed',
]);
const STATUS_BY_EVENT: Record<string, 'locked' | 'deleted'> = {
  'user.locked': 'locked',
  'user.deleted': 'deleted',
};

@Controller('webhooks')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(
    private readonly sessions: SessionService,
    private readonly users: UsersService,
    private readonly audit: AuditWriterService,
    @Inject(DRIZZLE_DB) private readonly db: Database,
  ) {}

  @Public()
  @Post('pmh-id')
  @HttpCode(200)
  async handle(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-pmh-signature') signature: string | undefined,
  ): Promise<{ ok: boolean }> {
    const rawBody = req.rawBody;
    if (!rawBody || !this.verifySignature(rawBody, signature)) {
      await this.audit.append({
        actor: 'system',
        action: 'auth.webhook_rejected',
        detail: { reason: signature ? 'bad_signature' : 'missing_signature' },
      });
      throw new UnauthorizedException({
        code: 'WEBHOOK_SIGNATURE_INVALID',
        message: 'Chữ ký webhook không hợp lệ.',
      });
    }

    // Payload hỏng → 400 (không 500): PMH ID sẽ retry mãi cùng payload hỏng
    const event = this.parseEvent(rawBody);

    // Kiểm trước, đánh dấu SAU khi xử: crash giữa chừng thì retry xử lại (mọi mutation idempotent)
    if (event.event_id && (await this.isProcessed(event.event_id))) {
      return { ok: true };
    }

    if (KICK_EVENTS.has(event.type)) {
      const killed = await this.sessions.destroyAllForUser(event.user_id);
      const status = STATUS_BY_EVENT[event.type];
      if (status) await this.users.setStatus(event.user_id, status);
      await this.audit.append({
        actor: 'system(webhook)',
        action: 'auth.session_revoked',
        objectType: 'user',
        objectId: event.user_id,
        detail: { event: event.type, sessions_killed: killed, status },
      });
    } else if (event.type === 'user.groups_changed' && event.groups) {
      await this.users.updateGroups(event.user_id, event.groups);
    } else {
      this.logger.log(`Webhook event bỏ qua: ${event.type}`);
    }
    if (event.event_id) await this.markProcessed(event.event_id);
    return { ok: true };
  }

  private async isProcessed(eventId: string): Promise<boolean> {
    const r = await this.db.execute<{ event_id: string }>(sql`
      SELECT event_id FROM processed_webhook_events WHERE event_id = ${eventId}
    `);
    return r.rows.length === 1;
  }

  private async markProcessed(eventId: string): Promise<void> {
    await this.db.execute(sql`
      INSERT INTO processed_webhook_events (event_id) VALUES (${eventId})
      ON CONFLICT (event_id) DO NOTHING
    `);
  }

  private parseEvent(rawBody: Buffer): PmhWebhookEvent {
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawBody.toString('utf8'));
    } catch {
      parsed = null;
    }
    const event = parsed as PmhWebhookEvent | null;
    if (
      !event ||
      typeof event !== 'object' ||
      typeof event.type !== 'string' ||
      typeof event.user_id !== 'string' ||
      (event.groups !== undefined && !Array.isArray(event.groups)) ||
      (event.event_id !== undefined && typeof event.event_id !== 'string')
    ) {
      throw new BadRequestException({
        code: 'WEBHOOK_PAYLOAD_INVALID',
        message: 'Payload webhook không đúng định dạng.',
      });
    }
    return event;
  }

  private verifySignature(
    rawBody: Buffer,
    signature: string | undefined,
  ): boolean {
    const secret = process.env.PMH_WEBHOOK_SECRET;
    if (!secret) {
      // Lỗi cấu hình chứ không phải client sai — log ERROR để vận hành thấy
      this.logger.error(
        'PMH_WEBHOOK_SECRET chưa cấu hình — TỪ CHỐI mọi webhook (thu hồi phiên sẽ không kích hoạt).',
      );
      return false;
    }
    if (!signature) {
      return false;
    }
    const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expected);
    // timingSafeEqual ném lỗi khi khác độ dài
    return sigBuf.length === expBuf.length && timingSafeEqual(sigBuf, expBuf);
  }
}
