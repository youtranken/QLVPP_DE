import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DRIZZLE_DB } from '../../database/database.module';
import type { Database } from '../../database/database.module';

// Bằng clockTolerance của jwtVerify: token còn được nhận tới exp + 60 s
const RETAIN_AFTER_EXP_S = 60;

@Injectable()
export class LogoutTokenJtiService {
  constructor(@Inject(DRIZZLE_DB) private readonly db: Database) {}

  // true = lần đầu thấy jti; false = đã dùng (kể cả request song song cùng jti)
  async claim(jti: string, expiresAt: Date): Promise<boolean> {
    await this.db.execute(
      sql`DELETE FROM logout_token_jti WHERE expires_at < now()`,
    );
    const r = await this.db.execute<{ jti: string }>(sql`
      INSERT INTO logout_token_jti (jti, expires_at)
      VALUES (${jti}, ${expiresAt.toISOString()}::timestamptz + make_interval(secs => ${RETAIN_AFTER_EXP_S}))
      ON CONFLICT (jti) DO NOTHING
      RETURNING jti
    `);
    return r.rows.length === 1;
  }
}
