import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Response } from 'express';
import { isUuid } from '../../common/uuid';
import { isDevAuthActive } from './auth-env';
import { SessionAuthService } from './session-auth.service';
import type { AuthedRequest, RequestIdentity } from './identity.types';
import { IS_PUBLIC_KEY } from './public.decorator';

export const DEV_SUB_HEADER = 'x-dev-user-sub';
export const DEV_ROLE_HEADER = 'x-dev-role';
export const SESSION_COOKIE = 'vpp_sid';

const DEV_ROLES = ['member', 'admin', 'sa'] as const;

export type DevRole = (typeof DEV_ROLES)[number];

@Injectable()
export class IdentityGuard implements CanActivate {
  private readonly logger = new Logger(IdentityGuard.name);
  private readonly devActive = isDevAuthActive(process.env);

  constructor(
    private readonly reflector: Reflector,
    private readonly sessionAuth: SessionAuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const request = context.switchToHttp().getRequest<AuthedRequest>();
    const response = context.switchToHttp().getResponse<Response>();

    if (this.devActive) {
      const sub = request.headers[DEV_SUB_HEADER];
      const role = request.headers[DEV_ROLE_HEADER];
      if (
        typeof sub === 'string' &&
        sub.length > 0 &&
        typeof role === 'string' &&
        (DEV_ROLES as readonly string[]).includes(role)
      ) {
        request.user = { sub, role, devMode: true };
        return true;
      }
    }

    // Kiểm uuid trước khi chạm DB: cookie rác làm Postgres ném 22P02 → 500 lặp, user kẹt
    const rawSessionId = (
      request.cookies as Record<string, string> | undefined
    )?.[SESSION_COOKIE];
    const sessionId =
      rawSessionId && isUuid(rawSessionId) ? rawSessionId : null;
    if (rawSessionId && !sessionId) {
      response.clearCookie(SESSION_COOKIE);
    }
    if (sessionId) {
      const identity = await this.resolveSession(sessionId, isPublic);
      if (identity) {
        request.user = identity;
        return true;
      }
      // undefined = PMH ID không tới được: giữ cookie để phiên SSO sống lại khi IdP về
      if (identity === null) response.clearCookie(SESSION_COOKIE);
    }

    if (isPublic) {
      return true;
    }
    throw new UnauthorizedException({
      code: 'UNAUTHENTICATED',
      message: 'Chưa đăng nhập hoặc phiên đã hết hạn — vui lòng đăng nhập lại.',
    });
  }

  // PMH ID sập: route @Public (sa-login, public-config) phải chạy ẩn danh — SA break-glass là lối vào duy nhất
  private async resolveSession(
    sessionId: string,
    isPublic: boolean | undefined,
  ): Promise<RequestIdentity | null | undefined> {
    try {
      return await this.sessionAuth.resolve(sessionId);
    } catch (error) {
      if (isPublic && error instanceof ServiceUnavailableException) {
        return undefined;
      }
      throw error;
    }
  }
}
