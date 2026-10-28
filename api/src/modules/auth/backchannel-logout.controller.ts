import {
  BadRequestException,
  Controller,
  HttpCode,
  Logger,
  Post,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuditWriterService } from '../audit/audit-writer.service';
import { JwtVerifierService } from './jwt-verifier.service';
import { Public } from './public.decorator';
import { SessionService } from './session.service';

// Logout của app chỉ hủy phiên local; đăng xuất toàn hệ ở portal về qua kênh này (chữ ký JWT, không HMAC).
@Controller('backchannel-logout')
export class BackchannelLogoutController {
  private readonly logger = new Logger(BackchannelLogoutController.name);

  constructor(
    private readonly jwtVerifier: JwtVerifierService,
    private readonly sessions: SessionService,
    private readonly audit: AuditWriterService,
  ) {}

  @Public()
  @Post()
  @HttpCode(200)
  async handle(@Req() req: Request): Promise<{ ok: boolean }> {
    const token = (req.body as { logout_token?: unknown } | undefined)
      ?.logout_token;
    if (typeof token !== 'string') {
      throw new BadRequestException({
        code: 'LOGOUT_TOKEN_MISSING',
        message: 'Thiếu logout_token.',
      });
    }
    let sub: string;
    try {
      ({ sub } = await this.jwtVerifier.verifyLogoutToken(token));
    } catch (error) {
      // 400 thay vì 500 để PMH ID không retry vô hạn
      this.logger.warn(`BCL từ chối: ${(error as Error).message}`);
      throw new BadRequestException({
        code: 'LOGOUT_TOKEN_INVALID',
        message: 'logout_token không hợp lệ.',
      });
    }
    const killed = await this.sessions.destroyAllForUser(sub);
    await this.audit.append({
      actor: 'system(bcl)',
      action: 'auth.session_revoked',
      objectType: 'user',
      objectId: sub,
      detail: { via: 'backchannel_logout', sessions_killed: killed },
    });
    return { ok: true };
  }
}
