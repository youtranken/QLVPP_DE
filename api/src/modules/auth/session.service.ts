import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { and, eq, lte, sql } from 'drizzle-orm';
import { DRIZZLE_DB } from '../../database/database.module';
import type { Database } from '../../database/database.module';
import type { PmhIdClaims } from '../users/users.service';
import { LOCAL_SA_SUB } from './local-sa-env';
import { hasEncKey } from '../../common/crypto-secret';
import {
  hashSessionId,
  newSessionCookie,
  openToken,
  sealToken,
} from './session-crypto';
import { sessionsTable } from './sessions.schema';

// Phiên app tối đa 12 h kể từ lúc đăng nhập (chuẩn phiên chung PMH ID), kể cả SA/tài khoản thử
export const SESSION_MAX_AGE_MS = 12 * 60 * 60 * 1000;

export interface SessionRecord {
  // Cookie vpp_sid thô (create trả về để set cookie; find trả lại đúng cookie đã tra) — không lưu DB
  id: string;
  userSub: string;
  refreshToken: string | null;
  accessToken: string | null;
  accessTokenExp: Date | null;
  claims: PmhIdClaims | null;
  csrfToken: string;
  idToken: string | null;
  lastSeenAt: Date;
  expiresAt: Date;
}

@Injectable()
export class SessionService implements OnModuleInit {
  private readonly logger = new Logger(SessionService.name);

  constructor(@Inject(DRIZZLE_DB) private readonly db: Database) {}

  // Prod thiếu khóa đã bị chặn lúc khởi động (assertEncKeyEnv); dev thiếu khóa → token lưu 'p:', cảnh báo một lần
  onModuleInit(): void {
    if (!hasEncKey()) {
      this.logger.warn(
        'CONFIG_ENC_KEY chưa đặt — token PMH ID trong bảng sessions lưu không mã hóa (chỉ chấp nhận ở dev).',
      );
    }
  }

  async create(params: {
    userSub: string;
    refreshToken: string | null;
    accessToken?: string | null;
    accessTokenExp: Date | null;
    claims: PmhIdClaims;
    idToken: string | null;
  }): Promise<SessionRecord> {
    await this.purgeExpired();
    const record: SessionRecord = {
      id: newSessionCookie(),
      userSub: params.userSub,
      refreshToken: params.refreshToken,
      accessToken: params.accessToken ?? null,
      accessTokenExp: params.accessTokenExp,
      claims: params.claims,
      csrfToken: randomBytes(32).toString('hex'),
      idToken: params.idToken,
      lastSeenAt: new Date(),
      expiresAt: new Date(Date.now() + SESSION_MAX_AGE_MS),
    };
    await this.insert(record);
    return record;
  }

  async createLocalSa(): Promise<SessionRecord> {
    await this.purgeExpired();
    const record: SessionRecord = {
      id: newSessionCookie(),
      userSub: LOCAL_SA_SUB,
      refreshToken: null,
      accessToken: null,
      accessTokenExp: null,
      claims: null,
      csrfToken: randomBytes(32).toString('hex'),
      idToken: null,
      lastSeenAt: new Date(),
      expiresAt: new Date(Date.now() + SESSION_MAX_AGE_MS),
    };
    await this.insert(record);
    return record;
  }

  private async insert(record: SessionRecord): Promise<void> {
    const { id, refreshToken, accessToken, idToken, ...rest } = record;
    await this.db.insert(sessionsTable).values({
      ...rest,
      idHash: hashSessionId(id),
      refreshToken: sealToken(refreshToken),
      accessToken: sealToken(accessToken),
      idToken: sealToken(idToken),
    });
  }

  async touchLastSeen(id: string): Promise<void> {
    await this.db
      .update(sessionsTable)
      .set({ lastSeenAt: new Date() })
      .where(eq(sessionsTable.idHash, hashSessionId(id)));
  }

  // Dọn phiên quá hạn 12 h (bỏ đi không logout): job định kỳ + mỗi lần tạo phiên. Trả số phiên đã xóa.
  async purgeExpired(): Promise<number> {
    const rows = await this.db
      .delete(sessionsTable)
      .where(lte(sessionsTable.expiresAt, sql`now()`))
      .returning({ idHash: sessionsTable.idHash });
    return rows.length;
  }

  async find(id: string): Promise<SessionRecord | null> {
    const rows = await this.db
      .select()
      .from(sessionsTable)
      .where(eq(sessionsTable.idHash, hashSessionId(id)));
    const row = rows[0];
    if (!row) {
      return null;
    }
    return {
      id,
      userSub: row.userSub,
      refreshToken: openToken(row.refreshToken),
      accessToken: openToken(row.accessToken),
      accessTokenExp: row.accessTokenExp,
      claims: row.claims as PmhIdClaims | null,
      csrfToken: row.csrfToken,
      idToken: openToken(row.idToken),
      lastSeenAt: row.lastSeenAt,
      expiresAt: row.expiresAt,
    };
  }

  // false = phiên đã bị xóa giữa chừng (webhook/BCL đá).
  // Ngôn ngữ (docs 7a): token mới mang claim cũ hơn lựa chọn vừa lưu trong phiên (refresh chạy song
  // song với PUT /api/me/locale) thì giữ locale/locale_updated_at của phiên — mốc mới hơn thắng.
  async updateTokens(
    id: string,
    params: {
      refreshToken: string | null;
      accessToken?: string | null;
      accessTokenExp: Date | null;
      claims: PmhIdClaims;
      idToken: string | null;
    },
  ): Promise<boolean> {
    const incoming = JSON.stringify(params.claims);
    const newAt = params.claims.locale_updated_at ?? null;
    const rows = await this.db
      .update(sessionsTable)
      .set({
        refreshToken: sealToken(params.refreshToken),
        accessToken: sealToken(params.accessToken),
        accessTokenExp: params.accessTokenExp,
        claims: sql`CASE
          WHEN (${sessionsTable.claims}->>'locale_updated_at') IS NOT NULL
           AND (${sessionsTable.claims}->>'locale_updated_at')::bigint
               > COALESCE(${newAt}::bigint, -1)
          THEN ${incoming}::jsonb || jsonb_build_object(
            'locale', ${sessionsTable.claims}->'locale',
            'locale_updated_at', ${sessionsTable.claims}->'locale_updated_at')
          ELSE ${incoming}::jsonb END`,
        idToken: sealToken(params.idToken),
        lastSeenAt: new Date(),
      })
      .where(eq(sessionsTable.idHash, hashSessionId(id)))
      .returning({ idHash: sessionsTable.idHash });
    return rows.length > 0;
  }

  // Lưu được ngôn ngữ vào PMH ID → claims phiên mang ngay giá trị mới (không chờ refresh), để /me
  // không nhảy về claim cũ trong phiên dù refresh sau đó lỗi. Chỉ phiên SSO (claims không null).
  async setSessionLocale(
    id: string,
    locale: 'vi' | 'en',
    atSec: number,
  ): Promise<void> {
    await this.db
      .update(sessionsTable)
      .set({
        claims: sql`${sessionsTable.claims} || jsonb_build_object(
          'locale', ${locale}::text, 'locale_updated_at', ${atSec}::bigint)`,
      })
      .where(
        and(
          eq(sessionsTable.idHash, hashSessionId(id)),
          sql`${sessionsTable.claims} IS NOT NULL`,
        ),
      );
  }

  async destroy(id: string): Promise<void> {
    await this.db
      .delete(sessionsTable)
      .where(eq(sessionsTable.idHash, hashSessionId(id)));
  }

  async destroyAllForUser(userSub: string): Promise<number> {
    const rows = await this.db
      .delete(sessionsTable)
      .where(eq(sessionsTable.userSub, userSub))
      .returning({ idHash: sessionsTable.idHash });
    return rows.length;
  }
}
