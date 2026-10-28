import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './roles.decorator';
import type { AppRole } from './roles.decorator';
import type { AuthedRequest } from './identity.types';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<AppRole[] | undefined>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required) {
      return true;
    }
    if (required.length === 0) {
      // @Roles() rỗng là lỗi khai báo — fail-closed thay vì mở cho mọi người
      throw new ForbiddenException({
        code: 'FORBIDDEN_ROLE',
        message: 'Route khai báo @Roles() rỗng — bị chặn mặc định.',
      });
    }
    const request = context.switchToHttp().getRequest<AuthedRequest>();
    const role = request.user?.role;
    if (role && (required as string[]).includes(role)) {
      return true;
    }
    throw new ForbiddenException({
      code: 'FORBIDDEN_ROLE',
      message: 'Bạn không có quyền thực hiện thao tác này.',
    });
  }
}
