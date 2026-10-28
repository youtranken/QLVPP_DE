import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import { Reflector } from '@nestjs/core';
import { SessionService } from './session.service';
import { IS_PUBLIC_KEY } from './public.decorator';
import type { AuthedRequest } from './identity.types';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

// Chỉ identity từ cookie phiên mới cần CSRF; dev-header không có cookie nên không có rủi ro CSRF.
@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sessions: SessionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthedRequest>();
    if (!MUTATING_METHODS.has(request.method)) {
      return true;
    }
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }
    const sessionId = request.user?.sessionId;
    if (!sessionId) {
      return true;
    }
    const token = request.headers['x-csrf-token'];
    if (typeof token === 'string' && token.length > 0) {
      const session = await this.sessions.find(sessionId);
      if (session && this.tokensMatch(session.csrfToken, token)) {
        return true;
      }
    }
    throw new ForbiddenException({
      code: 'CSRF_TOKEN_INVALID',
      message: 'Thiếu hoặc sai CSRF token — tải lại trang rồi thử lại.',
    });
  }

  private tokensMatch(expected: string, provided: string): boolean {
    const a = Buffer.from(expected);
    const b = Buffer.from(provided);
    return a.length === b.length && timingSafeEqual(a, b);
  }
}
