import { Controller, Get } from '@nestjs/common';

/** Health endpoint cho Docker healthcheck & kiểm tra sống. */
@Controller()
export class HealthController {
  @Get('/')
  root(): { status: string; service: string } {
    return { status: 'ok', service: 'de-vpp-api' };
  }

  @Get('/api/health')
  health(): { status: string } {
    return { status: 'ok' };
  }
}
