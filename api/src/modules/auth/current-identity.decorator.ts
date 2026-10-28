import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import type { AuthedRequest, RequestIdentity } from './identity.types';

export const CurrentIdentity = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): RequestIdentity => {
    const user = ctx.switchToHttp().getRequest<AuthedRequest>().user;
    if (!user) {
      throw new UnauthorizedException({
        code: 'UNAUTHENTICATED',
        message: 'Chưa đăng nhập.',
      });
    }
    return user;
  },
);
