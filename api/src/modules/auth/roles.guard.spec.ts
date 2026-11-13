import { ForbiddenException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Roles } from './roles.decorator';
import { RolesGuard } from './roles.guard';

class Routes {
  @Roles('admin', 'sa') adminOnly(): void {}
  @Roles() emptyRoles(): void {}
  open(): void {}
}

function contextFor(handler: keyof Routes, role?: string): ExecutionContext {
  return {
    // chỉ lấy tham chiếu hàm cho Reflector đọc metadata, không gọi
    // eslint-disable-next-line @typescript-eslint/unbound-method
    getHandler: () => Routes.prototype[handler],
    getClass: () => Routes,
    switchToHttp: () => ({
      getRequest: () => ({ user: role ? { role } : undefined }),
    }),
  } as unknown as ExecutionContext;
}

function codeOf(run: () => boolean): string {
  try {
    return run() ? 'ALLOWED' : 'DENIED';
  } catch (e) {
    expect(e).toBeInstanceOf(ForbiddenException);
    return (e as ForbiddenException).getResponse()['code' as never];
  }
}

describe('RolesGuard', () => {
  const guard = new RolesGuard(new Reflector());
  const check = (handler: keyof Routes, role?: string) =>
    codeOf(() => guard.canActivate(contextFor(handler, role)));

  it.each([
    ['sa', 'ALLOWED'],
    ['admin', 'ALLOWED'],
    ['member', 'FORBIDDEN_ROLE'],
    [undefined, 'FORBIDDEN_ROLE'],
  ])("@Roles('admin','sa') với vai %p → %s", (role, expected) => {
    expect(check('adminOnly', role)).toBe(expected);
  });

  it.each(['sa', 'admin', 'member'])(
    '@Roles() rỗng → 403 FORBIDDEN_ROLE cả với vai %s (fail-closed)',
    (role) => {
      expect(check('emptyRoles', role)).toBe('FORBIDDEN_ROLE');
    },
  );

  it('route không khai báo @Roles → cho qua', () => {
    expect(check('open', 'member')).toBe('ALLOWED');
  });
});
