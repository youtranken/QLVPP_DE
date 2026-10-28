import { Controller, Get, Inject, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Public } from '../modules/auth/public.decorator';
import { DB_PROBE, type DbProbe } from './db-probe';

// Healthcheck compose/update-vpp.sh: api sống mà mất DB vẫn phải báo hỏng
@Public()
@Controller('health')
export class HealthController {
  constructor(@Inject(DB_PROBE) private readonly probe: DbProbe) {}

  @Get()
  async check(
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ status: string }> {
    try {
      await this.probe();
      return { status: 'ok' };
    } catch {
      res.status(503);
      return { status: 'db_unavailable' };
    }
  }
}
