import { HttpException, Inject, Injectable, Logger } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import { DRIZZLE_DB } from '../../database/database.module';
import type { Database } from '../../database/database.module';
import { AuditWriterService } from '../audit/audit-writer.service';
import { DIRECTORY_CLIENT } from './directory.client';
import type { DirectoryClientApi, DirectoryUser } from './directory.client';
import { toLabel } from './profile-label';
import { usersTable } from './users.schema';

// iat theo đồng hồ PMH ID, mốc thu hồi theo đồng hồ DB: lệch giờ nghiêng về phía giữ thu hồi
export const LOGIN_REVOKE_SKEW_S = 30;

export type AppRole = 'admin' | 'member';
export type AccessSource = 'directory' | 'webhook';
export type RoleSource = 'login' | 'refresh' | 'webhook' | 'directory';

// Fail-closed: chỉ đúng chuỗi "admin" mới là Hành chính
export function toAppRole(v: unknown): AppRole {
  return v === 'admin' ? 'admin' : 'member';
}

export type LookupResult =
  | { kind: 'in'; user: DirectoryUser }
  | { kind: 'out' }
  | { kind: 'unknown'; code?: string };

// Directory: undefined = nguồn không nói gì → giữ; "" / null → NULL
export function directoryLabel(
  v: string | null | undefined,
): string | null | undefined {
  return v === undefined ? undefined : (toLabel(v) ?? null);
}

// Mốc rời active: lần đầu rời thì lấy giờ DB, đã không active thì giữ (so với iat khi đăng nhập)
export function inactiveAtFor(status: string): SQL | null {
  return status === 'active'
    ? null
    : sql`CASE WHEN ${usersTable.status} = 'active' OR ${usersTable.inactiveAt} IS NULL
        THEN clock_timestamp() ELSE ${usersTable.inactiveAt} END`;
}

function errorCode(error: unknown): string | undefined {
  const res = (error as HttpException)?.getResponse?.();
  return typeof res === 'object' && res !== null
    ? (res as { code?: string }).code
    : undefined;
}

// Trạng thái quyền vào VPP của user: thu hồi (no_access), thứ tự webhook, hỏi lại Directory.
// Không hủy phiên ở đây: toIdentity từ chối user không active ở request kế (tránh import vòng auth).
@Injectable()
export class UserAccessService {
  private readonly logger = new Logger(UserAccessService.name);

  constructor(
    @Inject(DRIZZLE_DB) private readonly db: Database,
    @Inject(DIRECTORY_CLIENT) private readonly directory: DirectoryClientApi,
    private readonly audit: AuditWriterService,
  ) {}

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

  // Đổi vai thì audit; không đổi thì không ghi gì (refresh mỗi ≤ 5′ không làm đầy nhật ký)
  async applyRole(
    sub: string,
    role: AppRole,
    source: RoleSource,
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

  // `notLoggedInSince`: sync bỏ qua người đăng nhập sau mốc bắt đầu (PMH ID vừa cấp token cho họ,
  // 404 có thể đến trước lần cấp lại) — lượt sau hoặc webhook sẽ xét lại.
  async markNoAccess(
    sub: string,
    source: AccessSource,
    actor: string,
    notLoggedInSince: Date | null = null,
  ): Promise<boolean> {
    const since = notLoggedInSince?.toISOString() ?? null;
    const r = await this.db.execute<{ from: string }>(sql`
      UPDATE users u SET status = 'no_access', inactive_at = clock_timestamp(), updated_at = now()
      FROM (SELECT sub, status FROM users WHERE sub = ${sub} FOR UPDATE) old
      WHERE u.sub = old.sub AND old.status IN ('active', 'locked') AND u.sub NOT LIKE 'local%'
        AND (${since}::timestamptz IS NULL OR u.last_login_at IS NULL
             OR u.last_login_at < ${since}::timestamptz)
      RETURNING old.status AS "from"
    `);
    const row = r.rows[0];
    if (!row) return false;
    this.logger.warn(`User ${sub} mất quyền vào VPP (${source})`);
    await this.audit.append({
      actor,
      action: 'users.access_revoked',
      objectType: 'user',
      objectId: sub,
      detail: { source, from: row.from },
    });
    return true;
  }

  // Chỉ mở no_access (khóa/xóa do PMH ID quyết qua status). Lần thu hồi phải cũ hơn `before`:
  // danh sách/sự kiện lấy trước một lần thu hồi mới không được mở lại người đó.
  async restoreActive(
    sub: string,
    before: Date,
    source: AccessSource,
    actor: string,
  ): Promise<boolean> {
    const at = before.toISOString();
    const r = await this.db.execute<{ from: string }>(sql`
      UPDATE users u SET status = 'active', inactive_at = NULL, updated_at = now()
      FROM (SELECT sub, status, inactive_at FROM users WHERE sub = ${sub} FOR UPDATE) old
      WHERE u.sub = old.sub AND old.status = 'no_access'
        AND (old.inactive_at IS NULL OR old.inactive_at < ${at}::timestamptz)
        AND NOT EXISTS (SELECT 1 FROM webhook_user_order w WHERE w.sub = u.sub
                        AND w.access_revoked AND w.updated_at >= ${at}::timestamptz)
      RETURNING old.status AS "from"
    `);
    const row = r.rows[0];
    if (!row) return false;
    await this.setAccessRevokedMark(sub, false);
    await this.audit.append({
      actor,
      action: 'users.access_restored',
      objectType: 'user',
      objectId: sub,
      detail: { source, from: row.from },
    });
    return true;
  }

  // Hồ sơ + vai từ Directory; người mới nhận status Directory báo, người cũ giữ status (người gọi quyết)
  async applyDirectoryUser(u: DirectoryUser, actor: string): Promise<void> {
    if (u.id.startsWith('local')) return;
    const dept = directoryLabel(u.department);
    const team = directoryLabel(u.team);
    await this.db.execute(sql`
      INSERT INTO users (sub, email, employee_code, full_name, department, team, role, status, inactive_at)
      VALUES (${u.id}, ${u.email ?? null}, ${u.employee_code ?? null}, ${u.full_name ?? null},
              ${dept ?? null}, ${team ?? null}, ${toAppRole(u.app_role)}, ${u.status},
              CASE WHEN ${u.status} = 'active' THEN NULL ELSE clock_timestamp() END)
      ON CONFLICT (sub) DO UPDATE SET
        email = CASE WHEN ${u.email === undefined} THEN users.email ELSE excluded.email END,
        employee_code = CASE WHEN ${u.employee_code === undefined} THEN users.employee_code
                             ELSE excluded.employee_code END,
        full_name = CASE WHEN ${u.full_name === undefined} THEN users.full_name ELSE excluded.full_name END,
        department = CASE WHEN ${dept === undefined} THEN users.department ELSE excluded.department END,
        team = CASE WHEN ${team === undefined} THEN users.team ELSE excluded.team END,
        updated_at = now()
    `);
    await this.applyRole(u.id, toAppRole(u.app_role), 'directory');
    this.logger.debug(`applyDirectoryUser ${u.id} (${actor})`);
  }

  async lookup(sub: string): Promise<LookupResult> {
    try {
      const user = await this.directory.fetchUser(sub);
      return user ? { kind: 'in', user } : { kind: 'out' };
    } catch (error) {
      this.logger.warn(
        `Không hỏi được Directory cho ${sub}: ${(error as Error).message}`,
      );
      return { kind: 'unknown', code: errorCode(error) };
    }
  }

  // User SSO có thể đã mất quyền; lâu chưa hỏi nhất trước để sub hay lỗi không chặn mãi người khác
  async reconcilePool(): Promise<string[]> {
    const r = await this.db.execute<{ sub: string }>(sql`
      SELECT sub FROM users
      WHERE status IN ('active', 'locked') AND sub NOT LIKE 'local%'
      ORDER BY access_checked_at ASC NULLS FIRST, sub
    `);
    return r.rows.map((x) => x.sub);
  }

  async touchChecked(sub: string): Promise<void> {
    await this.db.execute(
      sql`UPDATE users SET access_checked_at = now() WHERE sub = ${sub}`,
    );
  }

  // true: thu hồi là sự kiện quyền mới nhất (mốc updated_at chặn đăng nhập bằng token cũ hơn)
  async setAccessRevokedMark(sub: string, revoked: boolean): Promise<void> {
    if (revoked) {
      await this.db.execute(sql`
        INSERT INTO webhook_user_order (sub, access_revoked) VALUES (${sub}, true)
        ON CONFLICT (sub) DO UPDATE SET access_revoked = true, updated_at = now()
      `);
      return;
    }
    await this.db.execute(sql`
      UPDATE webhook_user_order SET access_revoked = false, updated_at = now()
      WHERE sub = ${sub} AND access_revoked
    `);
  }
}
