import { ACTIVE_REQUEST_STATUSES, REQUEST_STATUSES } from '@vpp/shared';
import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { items } from './catalog';
import { departments, users } from './identity';

export const requestStatusEnum = pgEnum('request_status', REQUEST_STATUSES);

/** Danh sách trạng thái "đang hiệu lực" dạng SQL literal — dùng cho partial unique index. */
const activeStatusList = sql.raw(ACTIVE_REQUEST_STATUSES.map((s) => `'${s}'`).join(', '));

/** Đơn đăng ký VPP của một người trong một kỳ (`period` = 'YYYY-MM'). */
export const requests = pgTable(
  'requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Mã đơn hiển thị cho người dùng, vd 'VPP-2026-08-0007'. */
    code: text('code').notNull().unique(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    /** Chụp lại phòng ban lúc gửi đơn — user có thể đổi phòng ban về sau. */
    departmentId: uuid('department_id').references(() => departments.id, { onDelete: 'set null' }),
    period: text('period').notNull(),
    status: requestStatusEnum('status').notNull().default('submitted'),
    note: text('note'),
    rejectReason: text('reject_reason'),
    approvedBy: uuid('approved_by').references(() => users.id, { onDelete: 'set null' }),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    deliveredAt: timestamp('delivered_at', { withTimezone: true }),
    reviewedBy: uuid('reviewed_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('requests_period_idx').on(table.period),
    index('requests_department_idx').on(table.departmentId),
    index('requests_status_idx').on(table.status),
    /**
     * BR: mỗi người chỉ 1 đơn ĐANG HIỆU LỰC mỗi kỳ (SDD §3).
     * Đơn rejected/cancelled giữ làm lịch sử nên nằm ngoài index này → cho phép gửi lại.
     */
    uniqueIndex('requests_active_per_period_idx')
      .on(table.userId, table.period)
      .where(sql`${table.status} in (${activeStatusList})`),
  ],
);

/** Một dòng trong đơn. `itemId` null = dòng thuộc mục "Khác" (tên tự nhập + ảnh đính kèm). */
export const requestItems = pgTable(
  'request_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    requestId: uuid('request_id')
      .notNull()
      .references(() => requests.id, { onDelete: 'cascade' }),
    itemId: uuid('item_id').references(() => items.id, { onDelete: 'set null' }),
    /** Chụp lại tên/đơn vị lúc gửi — danh mục đổi tên về sau không làm sai lịch sử đơn. */
    name: text('name').notNull(),
    unit: text('unit').notNull(),
    quantity: integer('quantity').notNull(),
    delivered: boolean('delivered').notNull().default(false),
    deliveredQty: integer('delivered_qty').notNull().default(0),
    attachmentPath: text('attachment_path'),
    note: text('note'),
  },
  (table) => [index('request_items_request_idx').on(table.requestId)],
);
