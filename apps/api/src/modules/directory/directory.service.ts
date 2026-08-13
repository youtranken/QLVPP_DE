import { Inject, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ErrorCode } from '@vpp/shared';
import { eq, sql } from 'drizzle-orm';
import { mapGroups } from '../../auth/group-mapping';
import { parseEnv, type AppConfig } from '../../infra/config/env';
import { DB, type Db } from '../../infra/db/db.module';
import { departments, users } from '../../infra/db/schema';
import { AuditService } from '../audit/audit.service';

/** Một bản ghi danh bạ trả về từ `GET /api/v1/users`. */
interface DirectoryUser {
  sub: string;
  email?: string | null;
  full_name?: string | null;
  employee_code?: string | null;
  groups?: string[] | null;
  disabled?: boolean | null;
}

interface DirectoryPage {
  total?: number;
  items?: DirectoryUser[];
}

const PAGE_SIZE = 200;

/** Xin token M2M sớm hơn hạn một chút để không dùng token sát giờ hết hạn. */
const TOKEN_EXPIRY_SKEW_MS = 30_000;

export interface SyncResult {
  fetched: number;
  upserted: number;
}

/**
 * Đồng bộ danh bạ từ PMH ID qua Directory API (ADMIN-4, SSO-INTEGRATION §7).
 * Mục đích: admin thấy được cả nhân viên **chưa từng đăng nhập**.
 */
@Injectable()
export class DirectoryService {
  private readonly logger = new Logger(DirectoryService.name);
  private readonly config: AppConfig = parseEnv();
  private token: { value: string; expiresAt: number } | null = null;

  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly audit: AuditService,
  ) {}

  /** Directory nằm cùng host với IdP; dùng URL NỘI BỘ khi có (api gọi server→server). */
  private get baseUrl(): string {
    if (this.config.PMH_DIRECTORY_URL) return this.config.PMH_DIRECTORY_URL.replace(/\/$/, '');
    const issuer = this.config.OIDC_INTERNAL_ISSUER || this.config.OIDC_ISSUER;
    // Bỏ hậu tố đường dẫn của issuer (vd '/oidc') để lấy gốc host.
    return new URL(issuer).origin;
  }

  private get tokenUrl(): string {
    const issuer = (this.config.OIDC_INTERNAL_ISSUER || this.config.OIDC_ISSUER).replace(/\/$/, '');
    return `${issuer}/token`;
  }

  /** Lấy access token bằng client_credentials, nhớ lại cho tới khi gần hết hạn. */
  private async getToken(): Promise<string> {
    if (this.token && this.token.expiresAt > Date.now()) return this.token.value;

    const body = new URLSearchParams({ grant_type: 'client_credentials' });
    const basic = Buffer.from(
      `${encodeURIComponent(this.config.PMH_M2M_CLIENT_ID)}:${encodeURIComponent(this.config.PMH_M2M_CLIENT_SECRET)}`,
    ).toString('base64');

    const response = await fetch(this.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${basic}`,
      },
      body,
    });
    if (!response.ok) {
      throw new Error(`Xin token M2M thất bại (${response.status}) tại ${this.tokenUrl}`);
    }

    const json = (await response.json()) as { access_token: string; expires_in?: number };
    this.token = {
      value: json.access_token,
      expiresAt: Date.now() + (json.expires_in ?? 300) * 1000 - TOKEN_EXPIRY_SKEW_MS,
    };
    return this.token.value;
  }

  /**
   * Kéo toàn bộ danh bạ và upsert vào bảng `users`.
   * Directory lỗi ⇒ **giữ nguyên dữ liệu cũ** và báo lỗi, không xoá gì cả (ADMIN-4).
   */
  async sync(actor: { id: string; name: string | null } | null = null): Promise<SyncResult> {
    let token: string;
    try {
      token = await this.getToken();
    } catch (error) {
      this.logger.error(`Không xin được token Directory: ${(error as Error).message}`);
      throw new ServiceUnavailableException({
        code: ErrorCode.INTERNAL,
        message: 'Không kết nối được Directory API của PMH ID. Dữ liệu danh bạ giữ nguyên.',
      });
    }

    const fetched: DirectoryUser[] = [];
    for (let offset = 0; ; offset += PAGE_SIZE) {
      const url = `${this.baseUrl}/api/v1/users?limit=${PAGE_SIZE}&offset=${offset}`;
      const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) {
        this.logger.error(`Directory trả ${response.status} tại ${url}`);
        throw new ServiceUnavailableException({
          code: ErrorCode.INTERNAL,
          message: 'Directory API lỗi. Dữ liệu danh bạ giữ nguyên.',
        });
      }
      const page = (await response.json()) as DirectoryPage;
      const items = page.items ?? [];
      fetched.push(...items);
      if (items.length < PAGE_SIZE) break;
    }

    let upserted = 0;
    for (const entry of fetched) {
      if (!entry.sub) continue;
      await this.upsert(entry);
      upserted += 1;
    }

    await this.audit.log({
      actor,
      action: 'directory.sync',
      objectType: 'directory',
      detail: { fetched: fetched.length, upserted },
    });
    this.logger.log(`Đồng bộ danh bạ: ${upserted}/${fetched.length} bản ghi.`);
    return { fetched: fetched.length, upserted };
  }

  /**
   * Upsert theo `pmh_sub`.
   * KHÔNG ghi đè `source` của người đã từng đăng nhập: `source='login'` mang thông
   * tin "đã dùng app", còn Directory chỉ bổ sung người chưa từng đăng nhập.
   */
  private async upsert(entry: DirectoryUser): Promise<void> {
    const groups = entry.groups ?? [];
    const identity = mapGroups(groups, {
      adminGroup: this.config.VPP_ADMIN_GROUP,
      departmentGroups: this.config.VPP_DEPARTMENT_GROUPS,
    });

    const values = {
      pmhSub: entry.sub,
      email: entry.email ?? null,
      name: entry.full_name ?? null,
      employeeCode: entry.employee_code ?? null,
      groups,
      department: identity.department,
      role: identity.role,
      disabled: entry.disabled ?? false,
      source: 'directory' as const,
      updatedAt: new Date(),
    };

    await this.db
      .insert(users)
      .values(values)
      .onConflictDoUpdate({
        target: users.pmhSub,
        set: { ...values, source: sql`${users.source}` },
      });

    if (identity.department) {
      await this.db.insert(departments).values({ name: identity.department }).onConflictDoNothing();
    }
  }

  /** Danh bạ để admin xem (ADMIN-3). */
  async listUsers(options: { search?: string; page: number; pageSize: number }) {
    const pattern = options.search ? `%${options.search.toLowerCase()}%` : null;
    const filter = pattern
      ? sql`lower(coalesce(${users.name}, '')) like ${pattern} or lower(coalesce(${users.email}, '')) like ${pattern}`
      : undefined;

    const [rows, [{ total }]] = await Promise.all([
      this.db
        .select({
          id: users.id,
          pmhSub: users.pmhSub,
          email: users.email,
          name: users.name,
          employeeCode: users.employeeCode,
          department: users.department,
          role: users.role,
          disabled: users.disabled,
          source: users.source,
          lastLoginAt: users.lastLoginAt,
        })
        .from(users)
        .where(filter)
        .orderBy(users.department, users.name)
        .limit(options.pageSize)
        .offset((options.page - 1) * options.pageSize),
      this.db
        .select({ total: sql<number>`count(*)::int` })
        .from(users)
        .where(filter),
    ]);

    return {
      items: rows.map((row) => ({ ...row, hasLoggedIn: row.lastLoginAt !== null })),
      total,
      page: options.page,
      pageSize: options.pageSize,
    };
  }

  listDepartments() {
    return this.db.select().from(departments).orderBy(departments.name);
  }

  /** Webhook `user.locked/deleted` ⇒ khoá user (huỷ phiên do WebhooksController lo). */
  async setDisabled(sub: string, disabled: boolean): Promise<boolean> {
    const updated = await this.db
      .update(users)
      .set({ disabled, updatedAt: new Date() })
      .where(eq(users.pmhSub, sub))
      .returning({ id: users.id });
    return updated.length > 0;
  }

  /** Webhook `groups_changed` ⇒ tính lại vai trò + phòng ban. */
  async applyGroupChange(sub: string, groups: string[]): Promise<boolean> {
    const identity = mapGroups(groups, {
      adminGroup: this.config.VPP_ADMIN_GROUP,
      departmentGroups: this.config.VPP_DEPARTMENT_GROUPS,
    });
    const updated = await this.db
      .update(users)
      .set({
        groups,
        department: identity.department,
        role: identity.role,
        updatedAt: new Date(),
      })
      .where(eq(users.pmhSub, sub))
      .returning({ id: users.id });

    if (identity.department) {
      await this.db.insert(departments).values({ name: identity.department }).onConflictDoNothing();
    }
    return updated.length > 0;
  }
}
