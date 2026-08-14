import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './identity';
import { requests } from './requests';

/** Thông báo trong app (chuông) — không gửi email (SDD §0 mục 11). */
export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    title: text('title').notNull(),
    body: text('body'),
    requestId: uuid('request_id').references(() => requests.id, { onDelete: 'cascade' }),
    readAt: timestamp('read_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('notifications_user_read_idx').on(table.userId, table.readAt)],
);

/**
 * Nhật ký audit — giữ vô thời hạn (SDD §9).
 * `actorName` chụp lại tên lúc thao tác để log vẫn đọc được nếu user bị xoá.
 */
export const auditLog = pgTable(
  'audit_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    actorId: uuid('actor_id').references(() => users.id, { onDelete: 'set null' }),
    actorName: text('actor_name'),
    action: text('action').notNull(),
    objectType: text('object_type'),
    objectId: text('object_id'),
    detail: jsonb('detail'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('audit_log_created_at_idx').on(table.createdAt)],
);

/**
 * Cài đặt toàn hệ thống — **đúng một dòng**.
 *
 * Khung ngày đăng ký từng là hằng số trong code; giờ admin sửa được ở màn Cài đặt
 * nên phải nằm trong CSDL. Ràng buộc `check (id)` cùng khoá chính khiến bảng chỉ
 * chứa được một dòng duy nhất: không có chuyện hai bản cài đặt cùng tồn tại rồi
 * mỗi tiến trình đọc phải một bản khác nhau.
 */
export const appSettings = pgTable(
  'app_settings',
  {
    id: boolean('id').primaryKey().default(true),
    /** Ngày mở đăng ký hằng tháng (1–31). */
    regWindowStartDay: integer('reg_window_start_day').notNull().default(20),
    /** Ngày đóng đăng ký (1–31); 31 nghĩa là "đến hết tháng". */
    regWindowEndDay: integer('reg_window_end_day').notNull().default(31),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
  },
  (table) => [
    check('app_settings_single_row', sql`${table.id}`),
    // Chặn ngay ở CSDL, không chỉ ở tầng ứng dụng: khung ngày sai làm cả công ty
    // mất một kỳ đăng ký, mà sửa tay bằng SQL là chuyện có thật khi xử lý sự cố.
    check(
      'app_settings_window_hop_le',
      sql`${table.regWindowStartDay} BETWEEN 1 AND 31
          AND ${table.regWindowEndDay} BETWEEN 1 AND 31
          AND ${table.regWindowStartDay} <= ${table.regWindowEndDay}`,
    ),
  ],
);
