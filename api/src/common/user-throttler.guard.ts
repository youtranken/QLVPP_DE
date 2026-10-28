import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { AuthedRequest } from '../modules/auth/identity.types';

// Theo user thay vì IP: sau nginx cả văn phòng chung một IP proxy. Đăng ký trong AuthModule sau IdentityGuard để req.user đã có.
@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  protected getTracker(req: AuthedRequest): Promise<string> {
    return Promise.resolve(req.user?.sub ?? req.ip ?? 'anonymous');
  }
}
