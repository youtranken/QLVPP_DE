import { Controller, Get, Inject, Res } from '@nestjs/common';
import type { Response } from 'express';
import type { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';
import { Public } from '../modules/auth/public.decorator';

// Healthcheck compose/update-vpp.sh: api sống mà mất DB vẫn phải báo hỏng
@Public()
@Controller('health')
export class HealthController {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  @Get()
  async check(
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ status: string }> {
    try {
      await this.pool.query('SELECT 1');
      return { status: 'ok' };
    } catch {
      res.status(503);
      return { status: 'db_unavailable' };
    }
  }
}
