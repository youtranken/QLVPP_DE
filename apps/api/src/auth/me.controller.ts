import { Controller, Get } from '@nestjs/common';
import {
  isRegistrationOpen,
  periodForDate,
  REG_WINDOW_END_DAY,
  REG_WINDOW_START_DAY,
} from '@vpp/shared';
import type { AuthenticatedUser } from './auth.service';
import { CurrentUser } from './roles.decorator';

/** Hồ sơ người dùng & trạng thái kỳ đăng ký — SSO-INTEGRATION §6, SDD §7. */
@Controller('api')
export class MeController {
  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser) {
    return {
      id: user.id,
      sub: user.pmhSub,
      email: user.email,
      name: user.name,
      role: user.role,
      department: user.department,
      groups: user.groups,
    };
  }

  /**
   * Cửa sổ đăng ký ngày 1–10 khoá cứng với NHÂN VIÊN; admin bỏ qua (SDD §6).
   * `canRegister` đã tính sẵn cho FE, nhưng backend vẫn kiểm lại khi nhận đơn ở M2.
   */
  @Get('registration/status')
  status(@CurrentUser() user: AuthenticatedUser) {
    const open = isRegistrationOpen();
    return {
      period: periodForDate(),
      open,
      canRegister: open || user.role === 'admin',
      windowStartDay: REG_WINDOW_START_DAY,
      windowEndDay: REG_WINDOW_END_DAY,
    };
  }
}
