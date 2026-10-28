import {
  Controller,
  HttpCode,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { Roles } from '../auth/roles.decorator';
import type { AuthedRequest } from '../auth/identity.types';
import { DirectorySyncService } from './directory-sync.service';
import type { DirectorySyncResult } from './directory-sync.service';

@Roles('sa', 'admin')
@Controller('admin/directory')
export class UsersController {
  constructor(private readonly directorySync: DirectorySyncService) {}

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
    return this.directorySync.sync(req.user.sub);
  }
}
