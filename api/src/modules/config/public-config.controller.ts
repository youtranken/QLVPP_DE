import { Controller, Get } from '@nestjs/common';
import { Public } from '../auth/public.decorator';
import { SystemConfigService } from './system-config.service';

// Cổng PMH ID = gốc của issuer (dev → dev-admin, prod → de-admin); thiếu/sai cấu hình → null
export function pmhPortalUrl(
  issuer = process.env.PMH_ISSUER_URL,
): string | null {
  if (!issuer) return null;
  try {
    return `${new URL(issuer).origin}/`;
  } catch {
    return null;
  }
}

// Trang "Chưa được cấp quyền" khi chưa có phiên cần liên hệ Hành chính và link về PMH ID — chỉ lộ đúng các khóa này
@Controller('public-config')
export class PublicConfigController {
  constructor(private readonly config: SystemConfigService) {}

  @Public()
  @Get()
  async get(): Promise<{
    admin_contact: string;
    pmh_portal_url: string | null;
  }> {
    return {
      admin_contact: await this.config.get<string>('admin_contact'),
      pmh_portal_url: pmhPortalUrl(),
    };
  }
}
