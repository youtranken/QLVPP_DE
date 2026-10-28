import {
  Body,
  Controller,
  Get,
  Put,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type { AuthedRequest } from '../auth/identity.types';
import { Roles } from '../auth/roles.decorator';
import { ConfigAdminService } from './config-admin.service';

@Controller('admin/config')
@Roles('sa', 'admin')
export class ConfigController {
  constructor(private readonly configAdmin: ConfigAdminService) {}

  @Get()
  list() {
    return this.configAdmin.listEditable();
  }

  // Body không qua DTO: validator riêng trả CONFIG_INVALID kèm field thay vì lỗi class-validator chung
  @Put()
  update(@Body() body: unknown, @Req() req: AuthedRequest) {
    if (!req.user) {
      throw new UnauthorizedException({
        code: 'UNAUTHENTICATED',
        message: 'Chưa đăng nhập.',
      });
    }
    return this.configAdmin.update(body, req.user.sub);
  }
}
