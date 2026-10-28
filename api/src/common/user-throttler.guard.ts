import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { ThrottlerRequest } from '@nestjs/throttler';
import type { AuthedRequest } from '../modules/auth/identity.types';
import { IP_THROTTLER } from './ip-throttler.guard';

// Theo user thay vì IP: sau nginx cả văn phòng chung một IP proxy. Đăng ký trong AuthModule sau IdentityGuard để req.user đã có.
@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  protected handleRequest(props: ThrottlerRequest): Promise<boolean> {
    if (props.throttler.name === IP_THROTTLER) return Promise.resolve(true);
    return super.handleRequest(props);
  }

  protected getTracker(req: AuthedRequest): Promise<string> {
    return Promise.resolve(req.user?.sub ?? req.ip ?? 'anonymous');
  }
}
