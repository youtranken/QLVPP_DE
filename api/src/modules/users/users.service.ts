import { Inject, Injectable } from '@nestjs/common';
import { and, eq, ilike, ne, or, sql } from 'drizzle-orm';
import { decodeCursor, encodeCursor } from '../../common/cursor';
import { escapeLike } from '../../common/sql';
import { DRIZZLE_DB } from '../../database/database.module';
import { AuditWriterService } from '../audit/audit-writer.service';
import type { Database, Executor } from '../../database/database.module';
import {
  LOCAL_SA_EMAIL,
  LOCAL_SA_FULL_NAME,
  LOCAL_SA_SUB,
} from '../auth/local-sa-env';
import { UserAccessService } from './user-access.service';
import { usersTable } from './users.schema';

export type AppRole = 'admin' | 'member';

// Hợp đồng PMH ID v3. Phiên cũ có `groups` trong jsonb claims thì để đó, không đọc.
export interface PmhIdClaims {
  sub: string;
  email?: string;
  employee_code?: string;
  full_name?: string;
  department?: string;
  team?: string;
  app_role?: AppRole;
  ver?: number;
}

// Fail-closed: chỉ đúng chuỗi "admin" mới là Hành chính
export function toAppRole(v: unknown): AppRole {
  return v === 'admin' ? 'admin' : 'member';
}

export interface UserListQuery {
  search?: string;
  limit: number;
  cursor?: string;
}

export interface UserListItem {
  sub: string;
  email: string | null;
  employeeCode: string | null;
  fullName: string | null;
  department: string | null;
  team: string | null;
  role: AppRole;
  status: string;
  lastLoginAt: Date | null;
}

const sortName = sql<string>`coalesce(${usersTable.fullName}, '')`;

@Injectable()
export class UsersService {
  constructor(
    @Inject(DRIZZLE_DB) private readonly db: Database,
    private readonly access: UserAccessService,
    private readonly audit: AuditWriterService,
  ) {}

  // SA cần users row để thỏa FK created_by_sub; role 'admin' vì CHECK cấm 'sa' — vai thật lấy từ phiên
  async ensureLocalSa(): Promise<void> {
    await this.db
      .insert(usersTable)
      .values({
        sub: LOCAL_SA_SUB,
        fullName: LOCAL_SA_FULL_NAME,
        email: LOCAL_SA_EMAIL,
        role: 'admin',
        status: 'active',
      })
      .onConflictDoUpdate({
        target: usersTable.sub,
        set: {
          fullName: LOCAL_SA_FULL_NAME,
          email: LOCAL_SA_EMAIL,
          status: 'active',
          updatedAt: sql`now()`,
        },
      });
  }

  // Tài khoản thử local (chỉ dev): login = active + đúng hồ sơ env, như user thật sau SSO.
  // Ghi role để chuông/mẫu số xử như Hành chính thật; vai của phiên vẫn lấy từ env.
  async upsertLocalTestAccount(params: {
    sub: string;
    fullName: string;
    email: string | null;
    department: string | null;
    team: string | null;
    role: AppRole;
  }): Promise<void> {
    const now = new Date();
    const profile = {
      fullName: params.fullName,
      email: params.email,
      department: params.department,
      team: params.team,
      role: params.role,
      status: 'active',
    };
    await this.db
      .insert(usersTable)
      .values({
        sub: params.sub,
        ...profile,
        firstLoginAt: now,
        lastLoginAt: now,
      })
      .onConflictDoUpdate({
        target: usersTable.sub,
        set: {
          ...profile,
          lastLoginAt: now,
          updatedAt: now,
          firstLoginAt: sql`COALESCE(${usersTable.firstLoginAt}, ${now.toISOString()})`,
        },
      });
  }

  async list(
    query: UserListQuery,
  ): Promise<{ items: UserListItem[]; next_cursor: string | null }> {
    const conds = [
      ne(usersTable.status, 'deleted'),
      ne(usersTable.sub, LOCAL_SA_SUB),
    ];
    if (query.search) {
      const pattern = `%${escapeLike(query.search)}%`;
      conds.push(
        or(
          ilike(usersTable.fullName, pattern),
          ilike(usersTable.email, pattern),
        )!,
      );
    }
    if (query.cursor) {
      const [name, sub] = decodeCursor(query.cursor, 2);
      conds.push(sql`(${sortName}, ${usersTable.sub}) > (${name}, ${sub})`);
    }
    const rows = await this.db
      .select({
        sub: usersTable.sub,
        email: usersTable.email,
        employeeCode: usersTable.employeeCode,
        fullName: usersTable.fullName,
        department: usersTable.department,
        team: usersTable.team,
        role: usersTable.role,
        status: usersTable.status,
        lastLoginAt: usersTable.lastLoginAt,
      })
      .from(usersTable)
      .where(and(...conds))
      .orderBy(sortName, usersTable.sub)
      .limit(query.limit + 1);
    const items = rows
      .slice(0, query.limit)
      .map((r) => ({ ...r, role: toAppRole(r.role) }));
    const last = items[items.length - 1];
    return {
      items,
      next_cursor:
        rows.length > query.limit && last
          ? encodeCursor([last.fullName ?? '', last.sub])
          : null,
    };
  }

  // Khóa theo `sub`: email đổi không tạo user mới. PMH ID chỉ cấp token cho người đang được vào VPP
  // nên đăng nhập đưa user về active, trừ khi có thu hồi mới hơn token (đua với thu hồi → 'revoked').
  async upsertFromClaims(
    claims: PmhIdClaims,
    issuedAt: Date | null = null,
  ): Promise<'ok' | 'revoked'> {
    const revoked = await this.access.revokedSince(claims.sub, issuedAt);
    const now = new Date();
    const profile = {
      email: claims.email ?? null,
      employeeCode: claims.employee_code ?? null,
      fullName: claims.full_name ?? null,
      department: claims.department ?? null,
      team: claims.team ?? null,
    };
    const reopen = { status: 'active', inactiveAt: null };
    await this.db
      .insert(usersTable)
      .values({
        sub: claims.sub,
        ...profile,
        role: toAppRole(claims.app_role),
        // Dấu thu hồi webhook có trước khi user tồn tại: tạo hồ sơ nhưng không cho vào
        ...(revoked ? { status: 'no_access', inactiveAt: sql`now()` } : reopen),
        firstLoginAt: now,
        lastLoginAt: now,
      })
      .onConflictDoUpdate({
        target: usersTable.sub,
        set: {
          ...profile,
          ...(revoked ? {} : reopen),
          lastLoginAt: now,
          updatedAt: now,
          firstLoginAt: sql`COALESCE(${usersTable.firstLoginAt}, ${now.toISOString()})`,
        },
      });
    await this.applyRole(claims.sub, toAppRole(claims.app_role), 'login');
    if (revoked) return 'revoked';
    await this.db.execute(sql`
      UPDATE webhook_user_order SET access_revoked = false, updated_at = now()
      WHERE sub = ${claims.sub} AND access_revoked
    `);
    return 'ok';
  }

  // Đổi vai thì audit; không đổi thì không ghi gì (refresh mỗi ≤ 5′ không làm đầy nhật ký)
  async applyRole(
    sub: string,
    role: AppRole,
    source: 'login' | 'refresh' | 'webhook' | 'directory',
  ): Promise<boolean> {
    const r = await this.db.execute<{ from: string }>(sql`
      UPDATE users u SET role = ${role}, updated_at = now()
      FROM (SELECT sub, role AS from_role FROM users WHERE sub = ${sub} FOR UPDATE) old
      WHERE u.sub = old.sub AND u.role IS DISTINCT FROM ${role}
      RETURNING old.from_role AS "from"
    `);
    const row = r.rows[0];
    if (!row) return false;
    await this.audit.append({
      actor: 'system(pmh-id)',
      action: 'users.role_changed',
      objectType: 'user',
      objectId: sub,
      detail: { from: row.from, to: role, source },
    });
    return true;
  }

  async findBySub(sub: string) {
    const rows = await this.db
      .select()
      .from(usersTable)
      .where(eq(usersTable.sub, sub));
    return rows[0] ?? null;
  }

  async setStatus(
    sub: string,
    status: 'active' | 'locked' | 'deleted',
  ): Promise<void> {
    // inactive_at = lần rời active đầu tiên (giữ nếu đã không active); đăng nhập so mốc này với iat
    const inactiveAt =
      status === 'active'
        ? null
        : sql`CASE WHEN ${usersTable.status} = 'active' OR ${usersTable.inactiveAt} IS NULL
            THEN clock_timestamp() ELSE ${usersTable.inactiveAt} END`;
    await this.db
      .update(usersTable)
      .set({ status, inactiveAt, updatedAt: new Date() })
      .where(eq(usersTable.sub, sub));
  }

  // Người nhận chuông admin: SA cục bộ không nhận
  async activeAdminSubs(ex: Executor = this.db): Promise<string[]> {
    const result = await ex.execute<{ sub: string }>(sql`
      SELECT u.sub FROM users u
      WHERE u.status = 'active' AND u.role = 'admin' AND u.sub <> ${LOCAL_SA_SUB}
      ORDER BY u.sub
    `);
    return result.rows.map((r) => r.sub);
  }
}
