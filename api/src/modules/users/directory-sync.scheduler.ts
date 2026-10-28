import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { SystemConfigService } from '../config/system-config.service';
import { DirectorySyncService } from './directory-sync.service';

export const DIRECTORY_SYNC_INTERVAL_MS = 60 * 60_000;
const CHECK_TICK_MS = 5 * 60_000;

// Nhịp lấy từ marker trong DB, không từ đồng hồ process: cài mới sync ngay (authorized_groups rỗng = gate mở),
// restart/deploy liên tục không đẩy lùi lần sync kế.
@Injectable()
export class DirectorySyncScheduler
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(DirectorySyncScheduler.name);
  private running: Promise<void> | null = null;

  constructor(
    private readonly config: SystemConfigService,
    private readonly directorySync: DirectorySyncService,
  ) {}

  onApplicationBootstrap(): void {
    void this.tick();
  }

  // Chờ lượt đang chạy trước khi pool DB đóng (onApplicationShutdown)
  async onModuleDestroy(): Promise<void> {
    await this.running;
  }

  @Interval(CHECK_TICK_MS)
  tick(): Promise<void> {
    this.running ??= this.runIfDue().finally(() => {
      this.running = null;
    });
    return this.running;
  }

  async runIfDue(): Promise<void> {
    try {
      const lastAt = await this.config.getDirectorySyncLastAt();
      if (lastAt && Date.now() - lastAt.getTime() < DIRECTORY_SYNC_INTERVAL_MS)
        return;
      // Ghi mốc trước khi chạy: lỗi thì đợi chu kỳ sau thay vì dội PMH ID mỗi tick
      await this.config.setDirectorySyncLastAt(new Date());
      const r = await this.directorySync.sync('system');
      this.logger.log(
        `sync định kỳ: total=${r.total} +${r.created} ~${r.updated}`,
      );
    } catch (e) {
      this.logger.error(`sync định kỳ lỗi: ${(e as Error).message}`);
    }
  }
}
