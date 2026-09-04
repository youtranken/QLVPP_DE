import { createHmac, timingSafeEqual } from 'node:crypto';
import {
  BadRequestException,
  Controller,
  HttpCode,
  Logger,
  Post,
  Req,
  type RawBodyRequest,
} from '@nestjs/common';
import { ErrorCode } from '@vpp/shared';
import type { Request } from 'express';
import { AuthService } from '../../auth/auth.service';
import { Public } from '../../auth/public.decorator';
import { parseEnv, type AppConfig } from '../../infra/config/env';
import { AuditService } from '../audit/audit.service';
import { DirectoryService } from './directory.service';
import { webhookTimestampToMs } from './pmh-payload';

/** Sự kiện cũ hơn ngần này bị từ chối — chặn tấn công phát lại (SSO-INTEGRATION §8). */
const TIMESTAMP_TOLERANCE_MS = 5 * 60 * 1000;

interface WebhookEvent {
  event?: string;
  sub?: string;
  groups?: string[];
}

/**
 * Nhận webhook từ PMH ID (AUTH-4, SSO-INTEGRATION §8).
 * `@Public` vì bên gọi là IdP, không có phiên người dùng — thay vào đó xác thực
 * bằng **HMAC-SHA256 v2** trên `${timestamp}.${raw body}`.
 */
@Public()
@Controller('api/webhooks')
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);
  private readonly config: AppConfig = parseEnv();

  constructor(
    private readonly directory: DirectoryService,
    private readonly auth: AuthService,
    private readonly audit: AuditService,
  ) {}

  @Post('pmh-id')
  @HttpCode(200)
  async receive(@Req() req: RawBodyRequest<Request>): Promise<{ ok: boolean; applied: boolean }> {
    const rawBody = req.rawBody;
    if (!rawBody) {
      throw new BadRequestException({ code: ErrorCode.VALIDATION, message: 'Thiếu nội dung.' });
    }

    this.verifySignature(req, rawBody);

    const payload = this.parse(rawBody);
    const sub = payload.sub;
    if (!sub) {
      throw new BadRequestException({ code: ErrorCode.VALIDATION, message: 'Thiếu `sub`.' });
    }

    // Idempotent: IdP có cơ chế retry nên cùng sự kiện có thể tới nhiều lần.
    // Mọi nhánh dưới đây đều là "đặt về trạng thái mong muốn", chạy lại vẫn đúng.
    let applied = false;
    switch (payload.event) {
      case 'user.locked':
      case 'user.deleted':
        applied = await this.directory.setDisabled(sub, true);
        await this.auth.destroySessionsBySub(sub);
        break;
      case 'user.unlocked':
        applied = await this.directory.setDisabled(sub, false);
        break;
      case 'user.groups_changed':
      case 'groups_changed':
        applied = await this.directory.applyGroupChange(sub, payload.groups ?? []);
        break;
      case 'user.password_changed':
        // App không quản mật khẩu; huỷ phiên cho chắc rồi thôi.
        await this.auth.destroySessionsBySub(sub);
        applied = true;
        break;
      default:
        this.logger.warn(`Bỏ qua sự kiện webhook không hỗ trợ: ${payload.event}`);
    }

    await this.audit.log({
      actor: null,
      action: `webhook.${payload.event ?? 'unknown'}`,
      objectType: 'user',
      objectId: sub,
      detail: { applied, groups: payload.groups ?? null },
    });

    return { ok: true, applied };
  }

  /**
   * HMAC-SHA256 v2 trên `${ts}.${body}`, so sánh bằng `timingSafeEqual`.
   * Chỉ chấp nhận v2 — v1 đã ngừng nhận (SSO-INTEGRATION §8).
   */
  private verifySignature(req: Request, rawBody: Buffer): void {
    const signature = req.get('x-pmh-signature-v2');
    const timestamp = req.get('x-pmh-timestamp');
    if (!signature || !timestamp) {
      throw new BadRequestException({
        code: ErrorCode.UNAUTHORIZED,
        message: 'Thiếu chữ ký hoặc timestamp.',
      });
    }

    // PMH ID gửi GIÂY, mock-idp gửi MILLI GIÂY — quy về một đơn vị trước khi so,
    // nếu không mọi webhook thật đều lệch ~1,79 tỉ và bị từ chối sạch.
    const sentAt = webhookTimestampToMs(timestamp);
    if (sentAt === null || Math.abs(Date.now() - sentAt) > TIMESTAMP_TOLERANCE_MS) {
      throw new BadRequestException({
        code: ErrorCode.UNAUTHORIZED,
        message: 'Timestamp không hợp lệ hoặc đã quá hạn.',
      });
    }

    const expected = createHmac('sha256', this.config.PMH_WEBHOOK_SECRET)
      .update(`${timestamp}.${rawBody.toString('utf8')}`)
      .digest();
    const received = Buffer.from(signature.replace(/^sha256=/, ''), 'hex');

    // timingSafeEqual ném lỗi nếu khác độ dài ⇒ kiểm trước.
    if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
      throw new BadRequestException({
        code: ErrorCode.UNAUTHORIZED,
        message: 'Chữ ký webhook không hợp lệ.',
      });
    }
  }

  private parse(rawBody: Buffer): WebhookEvent {
    try {
      return JSON.parse(rawBody.toString('utf8')) as WebhookEvent;
    } catch {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION,
        message: 'Body không phải JSON.',
      });
    }
  }
}
