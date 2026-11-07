import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, eq, ilike, ne, or, sql } from 'drizzle-orm';
import { decodeCursor, encodeCursor } from '../../common/cursor';
import { escapeLike } from '../../common/sql';
import { DRIZZLE_DB } from '../../database/database.module';
import type { Database, Executor } from '../../database/database.module';
import {
  LOCAL_SA_EMAIL,
  LOCAL_SA_FULL_NAME,
  LOCAL_SA_SUB,
} from '../auth/local-sa-env';
import { inAdminGroup } from './admin-group.sql';
import { usersTable } from './users.schema';

export interface PmhIdClaims {
  sub: string;
  email?: string;
  employee_code?: string;
  full_name?: string;
  department?: string;
  team?: string;
  groups?: string[];
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
  groups: unknown;
  status: string;
  lastLoginAt: Date | null;
}

const sortName = sql<string>`coalesce(${usersTable.fullName}, '')`;

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(@Inject(DRIZZLE_DB) private readonly db: Database) {}

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
  // groups mang admin_group hiện tại cho vai admin để chuông/danh sách xử như Hành chính thật.
  async upsertLocalTestAccount(params: {
    sub: string;
    fullName: string;
    email: string | null;
    department: string | null;
    team: string | null;
    role: 'admin' | 'member';
    groups: string[];
  }): Promise<void> {
    const now = new Date();
    const profile = {
      fullName: params.fullName,
      email: params.email,
      department: params.department,
      team: params.team,
      role: params.role,
      groups: params.groups,
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
        groups: usersTable.groups,
        status: usersTable.status,
        lastLoginAt: usersTable.lastLoginAt,
      })
      .from(usersTable)
      .where(and(...conds))
      .orderBy(sortName, usersTable.sub)
      .limit(query.limit + 1);
    const items = rows.slice(0, query.limit);
    const last = items[items.length - 1];
    return {
      items,
      next_cursor:
        rows.length > query.limit && last
          ? encodeCursor([last.fullName ?? '', last.sub])
          : null,
    };
  }

  // Khóa theo `sub`: email đổi không tạo user mới
  async upsertFromClaims(claims: PmhIdClaims): Promise<void> {
    const now = new Date();
    await this.db
      .insert(usersTable)
      .values({
        sub: claims.sub,
        email: claims.email ?? null,
        employeeCode: claims.employee_code ?? null,
        fullName: claims.full_name ?? null,
        department: claims.department ?? null,
        team: claims.team ?? null,
        groups: claims.groups ?? [],
        firstLoginAt: now,
        lastLoginAt: now,
      })
      .onConflictDoUpdate({
        target: usersTable.sub,
        set: {
          email: claims.email ?? null,
          employeeCode: claims.employee_code ?? null,
          fullName: claims.full_name ?? null,
          department: claims.department ?? null,
          team: claims.team ?? null,
          groups: claims.groups ?? [],
          lastLoginAt: now,
          updatedAt: now,
          firstLoginAt: sql`COALESCE(${usersTable.firstLoginAt}, ${now.toISOString()})`,
        },
      });
  }

  async findBySub(sub: string) {
    const rows = await this.db
      .select()
      .from(usersTable)
      .where(eq(usersTable.sub, sub));
    return rows[0] ?? null;
  }

  async updateGroups(sub: string, groups: string[]): Promise<void> {
    const rows = await this.db
      .update(usersTable)
      .set({ groups, updatedAt: new Date() })
      .where(eq(usersTable.sub, sub))
      .returning({ sub: usersTable.sub });
    if (rows.length === 0) {
      this.logger.warn(
        `groups_changed cho user chưa có trong DB (sub=${sub}) — bỏ qua, chờ login/sync`,
      );
    }
  }

  async setStatus(
    sub: string,
    status: 'active' | 'locked' | 'deleted',
  ): Promise<void> {
    await this.db
      .update(usersTable)
      .set({ status, updatedAt: new Date() })
      .where(eq(usersTable.sub, sub));
  }

  // Người nhận chuông admin: SA cục bộ không nhận; so group không phân biệt hoa thường như resolveRole
  async activeAdminSubs(
    adminGroup: string,
    ex: Executor = this.db,
  ): Promise<string[]> {
    const result = await ex.execute<{ sub: string }>(sql`
      SELECT u.sub FROM users u
      WHERE u.status = 'active' AND u.sub <> ${LOCAL_SA_SUB}
        AND ${inAdminGroup(sql`u.groups`, adminGroup)}
      ORDER BY u.sub
    `);
    return result.rows.map((r) => r.sub);
  }
}
