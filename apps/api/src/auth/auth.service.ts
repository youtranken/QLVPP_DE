import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, eq, gt } from 'drizzle-orm';
import type { TokenSet } from 'openid-client';
import { parseEnv, type AppConfig } from '../infra/config/env';
import { DB, type Db } from '../infra/db/db.module';
import { appSessions, auditLog, departments, users } from '../infra/db/schema';
import { mapGroups } from './group-mapping';
import type { OidcClaims } from './oidc.service';

/** Người dùng đã xác thực, gắn vào request sau khi AuthGuard chạy. */
export interface AuthenticatedUser {
  id: string;
  pmhSub: string;
  email: string | null;
  name: string | null;
  role: 'admin' | 'member';
  department: string | null;
  groups: string[];
}

export interface ActiveSession {
  sessionId: string;
  user: AuthenticatedUser;
  idToken: string | null;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly config: AppConfig = parseEnv();

  constructor(@Inject(DB) private readonly db: Db) {}

  /**
   * Tạo/cập nhật user theo `sub` PMH ID, suy vai trò từ `groups`.
   * `sub` là khoá tham chiếu duy nhất — email có thể đổi nên không dùng làm khoá.
   *
   * Phòng ban: ưu tiên claim `department` do PMH ID khai thẳng; không có thì mới
   * suy từ `groups` theo `VPP_DEPARTMENT_GROUPS`. Trước đây chỉ suy từ groups, nên
   * tài khoản thật có nhóm không nằm trong danh sách đó bị bỏ trống phòng ban.
   */
  async upsertUserFromClaims(claims: OidcClaims): Promise<AuthenticatedUser> {
    const identity = mapGroups(claims.groups, {
      adminGroup: this.config.VPP_ADMIN_GROUP,
      departmentGroups: this.config.VPP_DEPARTMENT_GROUPS,
    });
    const department = this.resolveDepartment(claims) ?? identity.department;

    const values = {
      pmhSub: claims.sub,
      email: claims.email,
      name: claims.name,
      employeeCode: claims.employeeCode,
      groups: claims.groups,
      department,
      role: identity.role,
      source: 'login' as const,
      lastLoginAt: new Date(),
      updatedAt: new Date(),
    };

    const [row] = await this.db
      .insert(users)
      .values(values)
      .onConflictDoUpdate({ target: users.pmhSub, set: values })
      .returning();

    if (department) await this.ensureDepartment(department);

    // Chỉ cảnh báo khi phòng ban thực sự được SUY từ groups. Có claim `department`
    // thì IdP đã chốt, nhiều nhóm cũng không còn là điều mơ hồ cần đối soát.
    if (!claims.department && identity.ambiguousDepartment) {
      // Trường hợp hiếm: user thuộc nhiều group phòng ban — ghi lại để admin đối soát (SSO §5).
      this.logger.warn(
        `User ${claims.sub} thuộc nhiều group phòng ban: ${claims.groups.join(', ')}`,
      );
      await this.db.insert(auditLog).values({
        actorId: row.id,
        actorName: row.name,
        action: 'auth.ambiguous_department',
        objectType: 'user',
        objectId: row.id,
        detail: { groups: claims.groups, chosen: identity.department },
      });
    }

    return this.toAuthenticatedUser(row);
  }

  /**
   * Phòng ban lấy từ claim, sau khi áp `VPP_DEPARTMENT_ALIASES`.
   * Trả `null` khi IdP không gửi claim, HOẶC khi alias đổi nó thành chuỗi rỗng
   * (nghĩa là "bỏ giá trị này") — cả hai trường hợp đều nhường cho `mapGroups`.
   */
  private resolveDepartment(claims: OidcClaims): string | null {
    if (!claims.department) return null;
    const alias = this.config.VPP_DEPARTMENT_ALIASES[claims.department];
    if (alias === undefined) return claims.department;
    return alias || null;
  }

  /** Bảng `departments` chỉ là cache tên phòng ban suy từ groups — thêm khi gặp tên mới. */
  private async ensureDepartment(name: string): Promise<void> {
    await this.db.insert(departments).values({ name }).onConflictDoNothing();
  }

  /** Tạo phiên BFF; giá trị trả về chính là nội dung cookie `vpp_sid`. */
  async createSession(
    userId: string,
    tokenSet: TokenSet,
  ): Promise<{ id: string; expiresAt: Date }> {
    const expiresAt = new Date(Date.now() + this.config.SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
    const [session] = await this.db
      .insert(appSessions)
      .values({
        userId,
        idToken: tokenSet.id_token ?? null,
        accessToken: tokenSet.access_token ?? null,
        refreshToken: tokenSet.refresh_token ?? null,
        accessExpiresAt: tokenSet.expires_at ? new Date(tokenSet.expires_at * 1000) : null,
        sessionExpiresAt: expiresAt,
      })
      .returning({ id: appSessions.id });
    return { id: session.id, expiresAt };
  }

  /** Đọc phiên còn hạn kèm user. Trả null nếu cookie sai, phiên hết hạn hoặc user bị khoá. */
  async findActiveSession(sessionId: string | undefined): Promise<ActiveSession | null> {
    if (!sessionId || !isUuid(sessionId)) return null;

    const [row] = await this.db
      .select({ session: appSessions, user: users })
      .from(appSessions)
      .innerJoin(users, eq(users.id, appSessions.userId))
      .where(and(eq(appSessions.id, sessionId), gt(appSessions.sessionExpiresAt, new Date())))
      .limit(1);

    if (!row || row.user.disabled) return null;
    return {
      sessionId: row.session.id,
      idToken: row.session.idToken,
      user: this.toAuthenticatedUser(row.user),
    };
  }

  /** Token OIDC của phiên — dùng cho việc làm mới access token. */
  async getSessionTokens(
    sessionId: string,
  ): Promise<{ refreshToken: string | null; accessExpiresAt: Date | null } | null> {
    const [row] = await this.db
      .select({
        refreshToken: appSessions.refreshToken,
        accessExpiresAt: appSessions.accessExpiresAt,
      })
      .from(appSessions)
      .where(eq(appSessions.id, sessionId))
      .limit(1);
    return row ?? null;
  }

  /** Lưu token MỚI sau khi refresh — không tái dùng token cũ (SSO-INTEGRATION §11). */
  async updateSessionTokens(sessionId: string, tokenSet: TokenSet): Promise<void> {
    await this.db
      .update(appSessions)
      .set({
        accessToken: tokenSet.access_token ?? null,
        // IdP có thể không phát refresh_token mới; giữ nguyên cái cũ khi đó.
        ...(tokenSet.refresh_token ? { refreshToken: tokenSet.refresh_token } : {}),
        ...(tokenSet.id_token ? { idToken: tokenSet.id_token } : {}),
        accessExpiresAt: tokenSet.expires_at ? new Date(tokenSet.expires_at * 1000) : null,
      })
      .where(eq(appSessions.id, sessionId));
  }

  /** Đăng xuất local: chỉ huỷ phiên của app, không đụng phiên ở IdP. */
  async destroySession(sessionId: string): Promise<void> {
    await this.db.delete(appSessions).where(eq(appSessions.id, sessionId));
  }

  /** Back-Channel Logout / user bị khoá: huỷ MỌI phiên của một `sub`. */
  async destroySessionsBySub(sub: string): Promise<number> {
    const [user] = await this.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.pmhSub, sub))
      .limit(1);
    if (!user) return 0;
    const deleted = await this.db
      .delete(appSessions)
      .where(eq(appSessions.userId, user.id))
      .returning({ id: appSessions.id });
    return deleted.length;
  }

  private toAuthenticatedUser(row: typeof users.$inferSelect): AuthenticatedUser {
    return {
      id: row.id,
      pmhSub: row.pmhSub,
      email: row.email,
      name: row.name,
      role: row.role,
      department: row.department,
      groups: row.groups,
    };
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Cookie do người dùng gửi lên: chặn giá trị không phải uuid trước khi truy vấn Postgres. */
function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}
