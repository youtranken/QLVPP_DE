import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { ThrottlerRequest } from '@nestjs/throttler';
import type { Request } from 'express';

export const IP_THROTTLER = 'ip';

// Chạy trước IdentityGuard: request chưa xác thực (cookie rác, sa-login) vẫn bị giới hạn theo IP thật (TRUST_PROXY_HOPS)
@Injectable()
export class IpThrottlerGuard extends ThrottlerGuard {
  protected handleRequest(props: ThrottlerRequest): Promise<boolean> {
    if (props.throttler.name !== IP_THROTTLER) return Promise.resolve(true);
    return super.handleRequest(props);
  }

  protected getTracker(req: Request): Promise<string> {
    return Promise.resolve(req.ip ?? 'unknown');
  }
}
