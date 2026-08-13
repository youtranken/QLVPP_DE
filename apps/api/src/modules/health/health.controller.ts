import { Controller, Get, Inject } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DB, type Db } from '../../infra/db/db.module';

/** Health endpoint cho Docker healthcheck & kiểm tra sống. */
@Controller()
export class HealthController {
  constructor(@Inject(DB) private readonly db: Db) {}

  @Get('/')
  root(): { status: string; service: string } {
    return { status: 'ok', service: 'de-vpp-api' };
  }

  /** `db: 'up' | 'down'` — chạm thật vào Postgres, không chỉ báo tiến trình còn sống. */
  @Get('/api/health')
  async health(): Promise<{ status: string; db: 'up' | 'down' }> {
    try {
      await this.db.execute(sql`select 1`);
      return { status: 'ok', db: 'up' };
    } catch {
      return { status: 'degraded', db: 'down' };
    }
  }
}
