import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { DirectorySyncService } from './directory-sync.service';

export const DIRECTORY_SYNC_INTERVAL_MS = 60 * 60_000;

@Injectable()
export class DirectorySyncScheduler {
  private readonly logger = new Logger(DirectorySyncScheduler.name);

  constructor(private readonly directorySync: DirectorySyncService) {}

  @Interval(DIRECTORY_SYNC_INTERVAL_MS)
  async run(): Promise<void> {
    try {
      const r = await this.directorySync.sync('system');
      this.logger.log(
        `sync định kỳ: total=${r.total} +${r.created} ~${r.updated}`,
      );
    } catch (e) {
      this.logger.error(`sync định kỳ lỗi: ${(e as Error).message}`);
    }
  }
}
