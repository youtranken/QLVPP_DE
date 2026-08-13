import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  createParamDecorator,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ErrorCode, type Role } from '@vpp/shared';
import type { AuthenticatedRequest } from './auth.guard';
import type { AuthenticatedUser } from './auth.service';

const ROLES_KEY = 'vpp:roles';

/** Giới hạn route theo vai trò. Phân quyền enforce ở BACKEND, không tin giao diện (SDD §2). */
export const Roles = (...roles: Role[]): MethodDecorator & ClassDecorator =>
  SetMetadata(ROLES_KEY, roles);

/** Lấy user đã xác thực: `@CurrentUser() user: AuthenticatedUser`. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser =>
    context.switchToHttp().getRequest<AuthenticatedRequest>().user,
);

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required?.length) return true;

    const { user } = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!user || !required.includes(user.role)) {
      throw new ForbiddenException({ code: ErrorCode.FORBIDDEN });
    }
    return true;
  }
}
