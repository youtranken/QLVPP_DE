import { Controller, Get, Req } from '@nestjs/common';
import type { Request } from 'express';
import type { EnvLike } from '../modules/auth/auth-env';
import { Public } from '../modules/auth/public.decorator';

@Public()
@Controller('_ip')
export class ClientIpController {
  @Get()
  ip(@Req() req: Request): { ip: string | undefined } {
    return { ip: req.ip };
  }
}

export function testOnlyControllers(
  env: EnvLike,
): Array<typeof ClientIpController> {
  return env.NODE_ENV === 'test' ? [ClientIpController] : [];
}
