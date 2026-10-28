import { Controller, Get } from '@nestjs/common';
import { Public } from '../auth/public.decorator';
import { SystemConfigService } from './system-config.service';

// Trang "Chưa được cấp quyền" cần liên hệ Hành chính khi chưa có phiên — chỉ lộ đúng khóa này
@Controller('public-config')
export class PublicConfigController {
  constructor(private readonly config: SystemConfigService) {}

  @Public()
  @Get()
  async get(): Promise<{ admin_contact: string }> {
    return { admin_contact: await this.config.get<string>('admin_contact') };
  }
}
