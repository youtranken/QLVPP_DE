import {
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { Roles } from '../auth/roles.decorator';
import type { AuthedRequest } from '../auth/identity.types';
import { SystemConfigService } from '../config/system-config.service';
import { DirectorySyncService } from './directory-sync.service';
import type { DirectorySyncResult } from './directory-sync.service';

export interface DirectorySyncStatusView {
  last_at: string | null;
  last_total: number | null;
  last_error: { at: string; code: string; message: string } | null;
}

@Roles('sa', 'admin')
@Controller('admin/directory')
export class UsersController {
  constructor(
    private readonly directorySync: DirectorySyncService,
    private readonly config: SystemConfigService,
  ) {}

  @Post('sync')
  @HttpCode(200)
  sync(@Req() req: AuthedRequest): Promise<DirectorySyncResult> {
    if (!req.user) {
      // Không fallback 'system' để không làm giả actor audit
      throw new UnauthorizedException({
        code: 'UNAUTHENTICATED',
        message: 'Chưa đăng nhập.',
      });
    }
    return this.directorySync.sync(req.user.sub, 'manual');
  }

  // Chỉ đọc config trong DB, không gọi PMH ID (trang Người dùng mở là gọi)
  @Get('status')
  async status(): Promise<DirectorySyncStatusView> {
    const s = await this.config.getDirectorySyncStatus();
    return {
      last_at: s.last_at?.toISOString() ?? null,
      last_total: s.last_total,
      last_error: s.last_error
        ? {
            at: s.last_error.at.toISOString(),
            code: s.last_error.code,
            message: s.last_error.message,
          }
        : null,
    };
  }
}
