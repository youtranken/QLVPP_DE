import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { and, eq, gt, lt, lte, or, sql } from 'drizzle-orm';
import { hasEncKey } from '../../common/crypto-secret';
import { DRIZZLE_DB } from '../../database/database.module';
import type { Database } from '../../database/database.module';
import { AuditWriterService } from '../audit/audit-writer.service';
import type { PmhIdClaims } from '../users/users.service';
import { LOCAL_SA_IDLE_MS, LOCAL_SA_SUB } from './local-sa-env';
import { hashSessionId, newSessionCookie, sealToken } from './session-crypto';
import {
  hasPlainTokenInProduction,
  SESSION_MAX_AGE_MS,
  toSessionRecord,
} from './session-record';
import type { SessionEndReason, SessionRecord } from './session-record';
import { sessionsTable } from './sessions.schema';

export { SESSION_MAX_AGE_MS } from './session-record';
export type { SessionEndReason, SessionRecord } from './session-record';

interface EndedRow {
  idHash: string;
  userSub: string;
}

@Injectable()
export class SessionService implements OnModuleInit {
  private readonly logger = new Logger(SessionService.name);

  constructor(
    @Inject(DRIZZLE_DB) private readonly db: Database,
    private readonly audit: AuditWriterService,
  ) {}

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
    return this.insert({
      ...params,
      accessToken: params.accessToken ?? null,
    });
  }

  createLocalSa(): Promise<SessionRecord> {
    return this.insert({
      userSub: LOCAL_SA_SUB,
      refreshToken: null,
      accessToken: null,
      accessTokenExp: null,
      claims: null,
      idToken: null,
    });
  }

  private async insert(
    fields: Pick<
      SessionRecord,
      | 'userSub'
      | 'refreshToken'
      | 'accessToken'
      | 'accessTokenExp'
      | 'claims'
      | 'idToken'
    >,
  ): Promise<SessionRecord> {
    const now = Date.now();
    const record: SessionRecord = {
      ...fields,
      id: newSessionCookie(),
      csrfToken: randomBytes(32).toString('hex'),
      lastSeenAt: new Date(now),
      expiresAt: new Date(now + SESSION_MAX_AGE_MS),
    };
    const idHash = hashSessionId(record.id);
    await this.db.insert(sessionsTable).values({
      idHash,
      userSub: record.userSub,
      refreshToken: sealToken(record.refreshToken, idHash),
      accessToken: sealToken(record.accessToken, idHash),
      accessTokenExp: record.accessTokenExp,
      claims: record.claims,
      idToken: sealToken(record.idToken, idHash),
      csrfToken: record.csrfToken,
      lastSeenAt: record.lastSeenAt,
      expiresAt: record.expiresAt,
    });
    return record;
  }

  async touchLastSeen(id: string): Promise<void> {
    await this.db
      .update(sessionsTable)
      .set({ lastSeenAt: new Date() })
      .where(eq(sessionsTable.idHash, hashSessionId(id)));
  }

  // Chỉ phiên còn hạn (now < expires_at) — mọi nơi gọi find đều được trần 12 h che
  async find(id: string): Promise<SessionRecord | null> {
    const rows = await this.db
      .select()
      .from(sessionsTable)
      .where(
        and(
          eq(sessionsTable.idHash, hashSessionId(id)),
          gt(sessionsTable.expiresAt, new Date(Date.now())),
        ),
      );
    const row = rows[0];
    if (!row || hasPlainTokenInProduction(row)) {
      return null;
    }
    return toSessionRecord(id, row);
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
    const idHash = hashSessionId(id);
    const incoming = JSON.stringify(params.claims);
    const newAt = params.claims.locale_updated_at ?? null;
    const rows = await this.db
      .update(sessionsTable)
      .set({
        refreshToken: sealToken(params.refreshToken, idHash),
        accessToken: sealToken(params.accessToken, idHash),
        accessTokenExp: params.accessTokenExp,
        claims: sql`CASE
          WHEN (${sessionsTable.claims}->>'locale_updated_at') IS NOT NULL
           AND (${sessionsTable.claims}->>'locale_updated_at')::bigint
               > COALESCE(${newAt}::bigint, -1)
          THEN ${incoming}::jsonb || jsonb_build_object(
            'locale', ${sessionsTable.claims}->'locale',
            'locale_updated_at', ${sessionsTable.claims}->'locale_updated_at')
          ELSE ${incoming}::jsonb END`,
        idToken: sealToken(params.idToken, idHash),
        lastSeenAt: new Date(),
      })
      .where(eq(sessionsTable.idHash, idHash))
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

  // Đăng xuất / đổi tài khoản: trả số dòng đã xóa (0 = phiên đã bị nơi khác xóa trước)
  async destroy(id: string): Promise<number> {
    const rows = await this.db
      .delete(sessionsTable)
      .where(eq(sessionsTable.idHash, hashSessionId(id)))
      .returning({ idHash: sessionsTable.idHash });
    return rows.length;
  }

  // Hủy phiên vì lý do của chuẩn phiên; chỉ ghi nhật ký khi chính lời gọi này xóa được dòng
  async expire(
    id: string,
    reason: SessionEndReason,
    cause?: string,
  ): Promise<boolean> {
    const rows = await this.db
      .delete(sessionsTable)
      .where(eq(sessionsTable.idHash, hashSessionId(id)))
      .returning({
        idHash: sessionsTable.idHash,
        userSub: sessionsTable.userSub,
      });
    this.recordEnded(rows, reason, cause);
    return rows.length > 0;
  }

  // Cookie trỏ tới phiên đã chạm trần 12 h: xóa ngay (không chờ job) và ghi absolute
  async expireIfPastMaxAge(id: string): Promise<boolean> {
    const rows = await this.db
      .delete(sessionsTable)
      .where(
        and(
          eq(sessionsTable.idHash, hashSessionId(id)),
          lte(sessionsTable.expiresAt, new Date(Date.now())),
        ),
      )
      .returning({
        idHash: sessionsTable.idHash,
        userSub: sessionsTable.userSub,
      });
    this.recordEnded(rows, 'absolute');
    return rows.length > 0;
  }

  // Job dọn: phiên chạm trần 12 h (absolute) và phiên SA bỏ quá 2 h (idle). Trả số phiên đã xóa.
  async purgeExpired(): Promise<number> {
    const now = new Date(Date.now());
    const rows = await this.db
      .delete(sessionsTable)
      .where(
        or(
          lte(sessionsTable.expiresAt, now),
          and(
            eq(sessionsTable.userSub, LOCAL_SA_SUB),
            lt(
              sessionsTable.lastSeenAt,
              new Date(now.getTime() - LOCAL_SA_IDLE_MS),
            ),
          ),
        ),
      )
      .returning({
        idHash: sessionsTable.idHash,
        userSub: sessionsTable.userSub,
        absolute: sql<boolean>`${sessionsTable.expiresAt} <= ${now}`,
      });
    this.recordEnded(
      rows.filter((r) => r.absolute),
      'absolute',
    );
    this.recordEnded(
      rows.filter((r) => !r.absolute),
      'idle',
    );
    return rows.length;
  }

  // Webhook/đồng bộ đá ra → 'revoked'; back-channel logout không ghi lý do (chuẩn phiên chung)
  async destroyAllForUser(
    userSub: string,
    reason?: SessionEndReason,
  ): Promise<number> {
    const rows = await this.db
      .delete(sessionsTable)
      .where(eq(sessionsTable.userSub, userSub))
      .returning({
        idHash: sessionsTable.idHash,
        userSub: sessionsTable.userSub,
      });
    this.recordEnded(rows, reason);
    return rows.length;
  }

  // Một auth.session_expired cho mỗi dòng đã xóa; không chờ (request không đợi nhật ký, append tự nuốt lỗi)
  private recordEnded(
    rows: EndedRow[],
    reason?: SessionEndReason,
    cause?: string,
  ): void {
    for (const row of rows) {
      void this.audit.append({
        actor: row.userSub,
        action: 'auth.session_expired',
        objectType: 'session',
        objectId: row.idHash.slice(0, 12),
        ...(reason ? { detail: { reason, ...(cause ? { cause } : {}) } } : {}),
      });
    }
  }
}
