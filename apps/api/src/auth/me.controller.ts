import { Controller, Get } from '@nestjs/common';
import { describeWindow, isRegistrationOpen, periodForDate } from '@vpp/shared';
import { SettingsService } from '../modules/settings/settings.service';
import type { AuthenticatedUser } from './auth.service';
import { CurrentUser } from './roles.decorator';

/** Hồ sơ người dùng & trạng thái kỳ đăng ký — SSO-INTEGRATION §6, SDD §7. */
@Controller('api')
export class MeController {
  constructor(private readonly settings: SettingsService) {}

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
   * Cửa sổ đăng ký khoá cứng với NHÂN VIÊN; admin bỏ qua (SDD §6).
   * `canRegister` đã tính sẵn cho FE, nhưng backend vẫn kiểm lại khi nhận đơn.
   *
   * Khung ngày do admin đặt nên FE **không tự suy ra được** — mọi nơi cần biết
   * "kỳ hiện tại" đều lấy từ đây thay vì tự tính.
   */
  @Get('registration/status')
  async status(@CurrentUser() user: AuthenticatedUser) {
    const window = await this.settings.getWindow();
    const open = isRegistrationOpen(window);
    return {
      period: periodForDate(window),
      open,
      canRegister: open || user.role === 'admin',
      windowStartDay: window.startDay,
      windowEndDay: window.endDay,
      windowLabel: describeWindow(window),
    };
  }
}
