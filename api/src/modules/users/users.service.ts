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
import {
  inactiveAtFor,
  LOGIN_REVOKE_SKEW_S,
  toAppRole,
  UserAccessService,
} from './user-access.service';
import type { AppRole, RoleSource } from './user-access.service';

export { toAppRole };
export type { AppRole };
import { usersTable } from './users.schema';

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
          // Cùng các trường ô tìm phía web khớp khi lọc tại chỗ (Nhóm, mã NV)
          ilike(usersTable.employeeCode, pattern),
          ilike(usersTable.team, pattern),
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
  // Điều kiện thu hồi xét ngay trong câu upsert trên hàng đã khóa: thu hồi commit giữa chừng không bị
  // ghi đè thành active; dấu access_revoked chỉ gỡ khi cũ hơn token.
  async upsertFromClaims(
    claims: PmhIdClaims,
    issuedAt: Date | null = null,
  ): Promise<'ok' | 'revoked'> {
    const now = new Date().toISOString();
    const role = toAppRole(claims.app_role);
    const cutoff = sql`(COALESCE(${issuedAt?.toISOString() ?? null}::timestamptz, now())
      - make_interval(secs => ${LOGIN_REVOKE_SKEW_S}))`;
    const markNewer = sql`EXISTS (SELECT 1 FROM webhook_user_order w WHERE w.sub = ${claims.sub}
      AND w.access_revoked AND w.updated_at > ${cutoff})`;
    const keep = sql`((users.status <> 'active' AND users.inactive_at > ${cutoff}) OR ${markNewer})`;
    const r = await this.db.execute<{ status: string }>(sql`
      INSERT INTO users (sub, email, employee_code, full_name, department, team, role, status,
                         inactive_at, first_login_at, last_login_at)
      SELECT ${claims.sub}, ${claims.email ?? null}, ${claims.employee_code ?? null},
             ${claims.full_name ?? null}, ${claims.department ?? null}, ${claims.team ?? null}, ${role},
             CASE WHEN m.revoked THEN 'no_access' ELSE 'active' END,
             CASE WHEN m.revoked THEN now() END, ${now}::timestamptz, ${now}::timestamptz
      FROM (SELECT ${markNewer} AS revoked) m
      ON CONFLICT (sub) DO UPDATE SET
        email = excluded.email, employee_code = excluded.employee_code,
        full_name = excluded.full_name, department = excluded.department, team = excluded.team,
        status = CASE WHEN ${keep} THEN users.status ELSE 'active' END,
        inactive_at = CASE WHEN ${keep} THEN users.inactive_at ELSE NULL END,
        last_login_at = excluded.last_login_at, updated_at = now(),
        first_login_at = COALESCE(users.first_login_at, excluded.first_login_at)
      RETURNING status
    `);
    await this.applyRole(claims.sub, role, 'login');
    if (r.rows[0]?.status !== 'active') return 'revoked';
    await this.db.execute(sql`
      UPDATE webhook_user_order SET access_revoked = false, updated_at = now()
      WHERE sub = ${claims.sub} AND access_revoked AND updated_at <= ${cutoff}
    `);
    return 'ok';
  }

  applyRole(sub: string, role: AppRole, source: RoleSource): Promise<boolean> {
    return this.access.applyRole(sub, role, source);
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
    const inactiveAt = inactiveAtFor(status);
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
