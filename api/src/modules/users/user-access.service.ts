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

export type SeqCategory = 'access' | 'status' | 'profile';

export type LostStatus = 'locked' | 'deleted' | 'no_access';
// Gọi sau khi người đó rời active (đã commit); lỗi của listener không được làm gãy webhook/sync
export type AccessLostListener = (
  sub: string,
  status: LostStatus,
) => Promise<void>;

export interface WebhookProfile {
  user_id: string;
  department?: string;
  team?: string | null;
  app_role?: string;
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
  private readonly lostListeners: AccessLostListener[] = [];

  constructor(
    @Inject(DRIZZLE_DB) private readonly db: Database,
    @Inject(DIRECTORY_CLIENT) private readonly directory: DirectoryClientApi,
    private readonly audit: AuditWriterService,
  ) {}

  // Người nghe đăng ký lúc khởi động (báo Admin việc dở ở NotificationsModule — tránh import vòng)
  onAccessLost(listener: AccessLostListener): void {
    this.lostListeners.push(listener);
  }

  // Chỉ gọi cho lần rời active → locked/deleted/no_access (mọi đường: webhook, sync, đối chiếu).
  // locked → deleted/no_access vẫn là cùng một lần mất quyền nên không gọi lại.
  async accessLost(sub: string, status: LostStatus): Promise<void> {
    for (const listener of this.lostListeners) {
      try {
        await listener(sub, status);
      } catch (error) {
        this.logger.warn(
          `Xử lý mất quyền của ${sub} lỗi: ${(error as Error).message}`,
        );
      }
    }
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
    if (row.from === 'active') await this.accessLost(sub, 'no_access');
    return true;
  }

  // Mặc định chỉ mở no_access (khóa/xóa do PMH ID quyết qua status); webhook mở khóa đã hỏi Directory
  // thì truyền thêm locked/deleted. Lần rời active phải cũ hơn `before`: danh sách/sự kiện lấy trước
  // một lần thu hồi mới không được mở lại người đó.
  async restoreActive(
    sub: string,
    before: Date,
    source: AccessSource,
    actor: string,
    from: readonly string[] = ['no_access'],
  ): Promise<boolean> {
    const at = before.toISOString();
    const fromList = sql.join(
      from.map((s) => sql`${s}`),
      sql`, `,
    );
    const r = await this.db.execute<{ from: string }>(sql`
      UPDATE users u SET status = 'active', inactive_at = NULL, updated_at = now()
      FROM (SELECT sub, status, inactive_at FROM users WHERE sub = ${sub} FOR UPDATE) old
      WHERE u.sub = old.sub AND old.status IN (${fromList})
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

  // Khoá/xoá theo Directory cho người đang active|locked; người đã no_access giữ nguyên (thu hồi xen giữa)
  async applyDirectoryStatus(
    sub: string,
    status: 'locked' | 'deleted',
  ): Promise<boolean> {
    const r = await this.db.execute<{ from: string }>(sql`
      UPDATE users u SET status = ${status},
        inactive_at = CASE WHEN old.status = 'active' OR old.inactive_at IS NULL
                           THEN clock_timestamp() ELSE old.inactive_at END,
        updated_at = now()
      FROM (SELECT sub, status, inactive_at FROM users WHERE sub = ${sub} FOR UPDATE) old
      WHERE u.sub = old.sub AND old.status IN ('active', 'locked') AND old.status <> ${status}
        AND u.sub NOT LIKE 'local%'
      RETURNING old.status AS "from"
    `);
    const row = r.rows[0];
    if (!row) return false;
    if (row.from === 'active') await this.accessLost(sub, status);
    return true;
  }

  // Hồ sơ từ payload webhook (chỉ user đã có); app_role chỉ ghi khi payload có
  async applyWebhookProfile(p: WebhookProfile): Promise<void> {
    const dept = directoryLabel(p.department);
    const team = directoryLabel(p.team);
    if (dept !== undefined || team !== undefined) {
      await this.db.execute(sql`
        UPDATE users SET
          department = CASE WHEN ${dept === undefined} THEN department ELSE ${dept ?? null} END,
          team = CASE WHEN ${team === undefined} THEN team ELSE ${team ?? null} END,
          updated_at = now()
        WHERE sub = ${p.user_id}
      `);
    }
    if (p.app_role !== undefined) {
      await this.applyRole(p.user_id, toAppRole(p.app_role), 'webhook');
    }
  }

  // Nhận seq nếu ≥ seq lớn nhất đã áp cùng loại: `=` để retry của chính sự kiện đó (crash trước khi
  // đánh dấu processed) xử lại được. Không chạm updated_at: mốc đó thuộc dấu access_revoked.
  async claimSeq(
    sub: string,
    category: SeqCategory,
    seq: bigint,
  ): Promise<boolean> {
    const n = seq.toString();
    const r = await this.db.execute<{ sub: string }>(sql`
      INSERT INTO webhook_user_order AS o (sub, seqs)
      VALUES (${sub}, jsonb_build_object(${category}::text, ${n}::numeric))
      ON CONFLICT (sub) DO UPDATE
        SET seqs = jsonb_set(o.seqs, ARRAY[${category}::text], to_jsonb(${n}::numeric))
        WHERE COALESCE((o.seqs ->> ${category}::text)::numeric, -1) <= ${n}::numeric
      RETURNING o.sub
    `);
    return r.rows.length === 1;
  }

  // Giờ DB (cùng nguồn với inactive_at) làm mốc trước khi hỏi Directory
  async dbNow(): Promise<Date> {
    const r = await this.db.execute<{ now: Date | string }>(
      sql`SELECT clock_timestamp() AS now`,
    );
    return new Date(r.rows[0].now);
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
