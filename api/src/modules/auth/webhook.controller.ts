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
import { sql } from 'drizzle-orm';
import type { Request } from 'express';
import { DRIZZLE_DB } from '../../database/database.module';
import type { Database } from '../../database/database.module';
import { AuditWriterService } from '../audit/audit-writer.service';
import { Public } from './public.decorator';
import { WebhookEventsService } from './webhook-events.service';
import type { PmhWebhookEventV3 } from './webhook-events.service';
import { verifyV2 } from './webhook-signature';

const MAX_TS_SKEW_SEC = 300;

@Controller('webhooks')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(
    private readonly events: WebhookEventsService,
    private readonly audit: AuditWriterService,
    @Inject(DRIZZLE_DB) private readonly db: Database,
  ) {}

  @Public()
  @Post('pmh-id')
  @HttpCode(200)
  async handle(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-pmh-signature-v2') signature: string | undefined,
    @Headers('x-pmh-timestamp') timestamp: string | undefined,
    @Headers('x-pmh-signature-v2-previous') previous?: string,
  ): Promise<{ ok: boolean; duplicate?: boolean }> {
    const rawBody = req.rawBody;
    const rejection = this.checkSignature(
      rawBody,
      timestamp,
      signature,
      previous,
    );
    if (rejection || !rawBody) {
      await this.audit.append({
        actor: 'system',
        action: 'auth.webhook_rejected',
        detail: { reason: rejection ?? 'missing' },
      });
      throw new UnauthorizedException({
        code: 'WEBHOOK_SIGNATURE_INVALID',
        message: 'Chữ ký webhook không hợp lệ.',
      });
    }

    // Payload hỏng → 400 (không 500): PMH ID sẽ retry mãi cùng payload hỏng
    const event = this.parseEvent(rawBody);

    // Kiểm trước, đánh dấu SAU khi xử: crash giữa chừng thì retry xử lại (mọi mutation idempotent)
    if (await this.isProcessed(event.event_id)) {
      return { ok: true, duplicate: true };
    }
    await this.events.apply(event);
    await this.markProcessed(event.event_id);
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

  // event_id là seq tăng dần (chuỗi chữ số): bắt buộc, dùng cho chống trùng và thứ tự theo loại
  private parseEvent(rawBody: Buffer): PmhWebhookEventV3 {
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawBody.toString('utf8'));
    } catch {
      parsed = null;
    }
    const e = parsed as Record<string, unknown> | null;
    const valid =
      !!e &&
      typeof e === 'object' &&
      !Array.isArray(e) &&
      typeof e.type === 'string' &&
      typeof e.user_id === 'string' &&
      e.user_id.length > 0 &&
      typeof e.event_id === 'string' &&
      /^\d{1,30}$/.test(e.event_id) &&
      (e.team === undefined || e.team === null || typeof e.team === 'string') &&
      // PMH ID gửi "detail": null cho sự kiện không có chi tiết (user.locked/unlocked…)
      (e.detail === undefined ||
        e.detail === null ||
        (typeof e.detail === 'object' && !Array.isArray(e.detail)));
    if (!valid) {
      throw new BadRequestException({
        code: 'WEBHOOK_PAYLOAD_INVALID',
        message: 'Payload webhook không đúng định dạng.',
      });
    }
    const str = (v: unknown) => (typeof v === 'string' ? v : undefined);
    const detail = e.detail as Record<string, unknown> | undefined;
    return {
      type: e.type as string,
      user_id: e.user_id as string,
      event_id: e.event_id as string,
      department: str(e.department),
      team: e.team as string | null | undefined,
      app_role: str(e.app_role),
      detail: detail
        ? { client_id: str(detail.client_id), change: str(detail.change) }
        : undefined,
      at: str(e.at),
    };
  }

  private checkSignature(
    rawBody: Buffer | undefined,
    timestamp: string | undefined,
    signature: string | undefined,
    previousSignature: string | undefined,
  ): 'missing' | 'skew' | 'mismatch' | 'no_secret' | null {
    const secret = process.env.PMH_WEBHOOK_SECRET;
    if (!secret) {
      // Lỗi cấu hình chứ không phải client sai — log ERROR để vận hành thấy
      this.logger.error(
        'PMH_WEBHOOK_SECRET chưa cấu hình — TỪ CHỐI mọi webhook (thu hồi phiên sẽ không kích hoạt).',
      );
      return 'no_secret';
    }
    const result = verifyV2({
      secret,
      ts: timestamp,
      rawBody,
      signature,
      previousSignature,
      nowSec: Math.floor(Date.now() / 1000),
      skewSec: webhookSkewSec(),
    });
    return result.ok ? null : result.reason;
  }
}

// Chuẩn PMH ID: cửa sổ tối đa 300 s; env chỉ được thu hẹp, không nới
function webhookSkewSec(): number {
  const n = Number(process.env.WEBHOOK_TS_SKEW_SEC);
  return Number.isInteger(n) && n > 0
    ? Math.min(n, MAX_TS_SKEW_SEC)
    : MAX_TS_SKEW_SEC;
}
