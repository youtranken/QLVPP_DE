import { Body, Controller, Get, Patch } from '@nestjs/common';
import type { AuthenticatedUser } from '../../auth/auth.service';
import { CurrentUser, Roles } from '../../auth/roles.decorator';
import { ZodPipe } from '../../infra/validation/zod.pipe';
import { UpdateWindowSchema, type UpdateWindowDto } from './settings.dto';
import { SettingsService, type AppSettingsView } from './settings.service';

/** Cài đặt hệ thống — chỉ admin (ADMIN-8). */
@Roles('admin')
@Controller('api/admin/settings')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  get(): Promise<AppSettingsView> {
    return this.settings.get();
  }

  @Patch('registration-window')
  update(
    @CurrentUser() admin: AuthenticatedUser,
    @Body(new ZodPipe(UpdateWindowSchema)) body: UpdateWindowDto,
  ): Promise<AppSettingsView> {
    return this.settings.updateWindow(body, { id: admin.id, name: admin.name });
  }
}
