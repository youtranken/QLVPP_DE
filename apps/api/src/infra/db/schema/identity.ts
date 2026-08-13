import { ROLES, USER_SOURCES } from '@vpp/shared';
import { boolean, index, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const roleEnum = pgEnum('role', ROLES);
export const userSourceEnum = pgEnum('user_source', USER_SOURCES);

/**
 * Cache tên phòng ban suy ra từ `groups` PMH ID — phục vụ lọc/báo cáo.
 * Danh tính do PMH ID quản; bảng này KHÔNG phải nguồn sự thật.
 */
export const departments = pgTable('departments', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Người dùng — khoá tham chiếu là `pmhSub` (`sub` của PMH ID), KHÔNG phải email.
 * Không có cột mật khẩu: app không bao giờ quản mật khẩu (SSO-INTEGRATION §4).
 */
export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    pmhSub: text('pmh_sub').notNull().unique(),
    email: text('email'),
    name: text('name'),
    employeeCode: text('employee_code'),
    /** Toàn bộ group từ token/Directory — giữ để tra cứu, đối soát. */
    groups: text('groups').array().notNull().default([]),
    /** Suy ra từ `groups` (SSO-INTEGRATION §5); null khi user chỉ có group admin. */
    department: text('department'),
    role: roleEnum('role').notNull().default('member'),
    disabled: boolean('disabled').notNull().default(false),
    source: userSourceEnum('source').notNull().default('login'),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('users_department_idx').on(table.department)],
);

/**
 * Phiên BFF: `id` chính là giá trị cookie `vpp_sid`.
 * Token OIDC nằm ở server, trình duyệt chỉ giữ cookie httpOnly (SSO-INTEGRATION §2).
 */
export const appSessions = pgTable(
  'app_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** Cần cho `end_session` (đăng xuất toàn hệ) — id_token_hint. */
    idToken: text('id_token'),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    accessExpiresAt: timestamp('access_expires_at', { withTimezone: true }),
    sessionExpiresAt: timestamp('session_expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('app_sessions_user_id_idx').on(table.userId),
    index('app_sessions_expires_idx').on(table.sessionExpiresAt),
  ],
);
