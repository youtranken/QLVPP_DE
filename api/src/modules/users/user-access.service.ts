import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DRIZZLE_DB } from '../../database/database.module';
import type { Database } from '../../database/database.module';

// iat theo đồng hồ PMH ID, mốc thu hồi theo đồng hồ DB: lệch giờ nghiêng về phía giữ thu hồi
export const LOGIN_REVOKE_SKEW_S = 30;

// Trạng thái quyền vào VPP của user: thu hồi (no_access), thứ tự webhook, hỏi lại Directory
@Injectable()
export class UserAccessService {
  constructor(@Inject(DRIZZLE_DB) private readonly db: Database) {}

  // Có lần rời active (khóa/xóa/mất quyền) hoặc dấu access_revoked của webhook mới hơn token đăng nhập?
  // Thiếu iat → so với giờ DB hiện tại. So ở SQL để cả hai mốc cùng đồng hồ DB.
  async revokedSince(sub: string, iat: Date | null): Promise<boolean> {
    const r = await this.db.execute<{ revoked: boolean | null }>(sql`
      SELECT GREATEST(
        (SELECT inactive_at FROM users WHERE sub = ${sub} AND status <> 'active'),
        (SELECT updated_at FROM webhook_user_order WHERE sub = ${sub} AND access_revoked)
      ) > COALESCE(${iat?.toISOString() ?? null}::timestamptz, now())
          - make_interval(secs => ${LOGIN_REVOKE_SKEW_S}) AS revoked
    `);
    return r.rows[0]?.revoked === true;
  }
}
