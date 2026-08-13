import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ErrorCode } from '@vpp/shared';
import type { Request } from 'express';
import { AuthService, type AuthenticatedUser } from './auth.service';
import { SESSION_COOKIE } from './cookies';
import { IS_PUBLIC } from './public.decorator';
import { OidcService } from './oidc.service';

/** Request đã qua AuthGuard thì chắc chắn có `user`. */
export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
  sessionId: string;
}

/** Làm mới access token khi còn dưới ngần này là hết hạn, tránh dùng token sát giờ. */
const REFRESH_SKEW_MS = 60 * 1000;

/**
 * Xác thực bằng cookie phiên BFF.
 * Access token hết hạn thì tự refresh; **refresh thất bại = đăng xuất**
 * — cơ chế này phủ cả trường hợp user bị khoá ở IdP mà webhook/BCL chưa tới (SSO §11).
 */
@Injectable()
export class AuthGuard implements CanActivate {
  private readonly logger = new Logger(AuthGuard.name);

  constructor(
    private readonly auth: AuthService,
    private readonly oidc: OidcService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const sessionId = request.cookies?.[SESSION_COOKIE] as string | undefined;
    const session = await this.auth.findActiveSession(sessionId);
    if (!session) throw new UnauthorizedException({ code: ErrorCode.UNAUTHORIZED });

    await this.refreshIfNeeded(session.sessionId);

    request.user = session.user;
    request.sessionId = session.sessionId;
    return true;
  }

  private async refreshIfNeeded(sessionId: string): Promise<void> {
    const tokens = await this.auth.getSessionTokens(sessionId);
    if (!tokens?.accessExpiresAt) return;
    if (tokens.accessExpiresAt.getTime() - Date.now() > REFRESH_SKEW_MS) return;

    if (!tokens.refreshToken) {
      await this.auth.destroySession(sessionId);
      throw new UnauthorizedException({ code: ErrorCode.UNAUTHORIZED });
    }

    try {
      await this.auth.updateSessionTokens(sessionId, await this.oidc.refresh(tokens.refreshToken));
    } catch (error) {
      this.logger.warn(
        `Refresh token thất bại, huỷ phiên ${sessionId}: ${(error as Error).message}`,
      );
      await this.auth.destroySession(sessionId);
      throw new UnauthorizedException({ code: ErrorCode.UNAUTHORIZED });
    }
  }
}
