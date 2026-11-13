import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { SessionService } from './session.service';

// Dọn phiên quá hạn 12 h mà không ai gọi lại (đóng tab, không đăng xuất) — log chỉ ghi số lượng
@Injectable()
export class SessionCleanupJob {
  private readonly logger = new Logger(SessionCleanupJob.name);

  constructor(private readonly sessions: SessionService) {}

  @Cron('*/15 * * * *', { name: 'session-cleanup' })
  async run(): Promise<void> {
    try {
      const n = await this.sessions.purgeExpired();
      if (n > 0) this.logger.log(`dọn ${n} phiên quá hạn`);
    } catch (e) {
      this.logger.error(`dọn phiên quá hạn lỗi: ${(e as Error).message}`);
    }
  }
}
