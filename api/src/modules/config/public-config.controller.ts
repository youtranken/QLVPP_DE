import { Controller, Get } from '@nestjs/common';
import { Public } from '../auth/public.decorator';

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

// Trang "Chưa được cấp quyền" khi chưa có phiên cần link về PMH ID — chỉ lộ đúng khóa này
@Controller('public-config')
export class PublicConfigController {
  @Public()
  @Get()
  get(): { pmh_portal_url: string | null } {
    return { pmh_portal_url: pmhPortalUrl() };
  }
}
