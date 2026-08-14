import { Controller, Injectable, Logger, Post } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import type { AuthenticatedUser } from '../../auth/auth.service';
import { CurrentUser, Roles } from '../../auth/roles.decorator';
import { parseEnv } from '../../infra/config/env';
import { UploadsCleanupService } from './uploads-cleanup.service';

/** Chạy dọn ảnh ngay — để kiểm chứng sau khi triển khai mà không phải chờ job. */
@Roles('admin')
@Controller('api/admin/uploads')
export class UploadsCleanupController {
  constructor(private readonly cleanup: UploadsCleanupService) {}

  @Post('cleanup')
  run(@CurrentUser() admin: AuthenticatedUser) {
    return this.cleanup.cleanup({ id: admin.id, name: admin.name });
  }
}

/**
 * Job dọn ảnh chạy trong tiến trình api (ADR-0008: không Redis/worker riêng).
 * Nuốt lỗi tại đây — job nền không được làm sập tiến trình; lần sau tự chạy lại.
 */
@Injectable()
export class UploadsCleanupJob {
  private readonly logger = new Logger(UploadsCleanupJob.name);

  constructor(private readonly cleanup: UploadsCleanupService) {}

  @Interval('uploads-cleanup', parseEnv().UPLOAD_CLEANUP_HOURS * 60 * 60 * 1000)
  async run(): Promise<void> {
    try {
      await this.cleanup.cleanup(null);
    } catch (error) {
      this.logger.warn(`Dọn ảnh định kỳ thất bại: ${(error as Error).message}`);
    }
  }
}
