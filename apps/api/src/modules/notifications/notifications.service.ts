import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { DB, type Db } from '../../infra/db/db.module';
import { notifications, users } from '../../infra/db/schema';

/** Loại thông báo — dùng để FE chọn icon và điều hướng. */
export const NOTIFICATION_TYPES = {
  requestApproved: 'request.approved',
  requestRejected: 'request.rejected',
  requestDelivered: 'request.delivered',
  requestSubmitted: 'request.submitted',
  requestAdjusted: 'request.adjusted',
} as const;

export interface NewNotification {
  userId: string;
  type: string;
  title: string;
  body?: string | null;
  requestId?: string | null;
}

/** Thông báo TRONG APP (chuông) — không gửi email (SDD §0 mục 11). */
@Injectable()
export class NotificationsService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async notify(entry: NewNotification, tx: Db | undefined = undefined): Promise<void> {
    await (tx ?? this.db).insert(notifications).values({
      userId: entry.userId,
      type: entry.type,
      title: entry.title,
      body: entry.body ?? null,
      requestId: entry.requestId ?? null,
    });
  }

  /**
   * Báo cho MỌI admin (NOTIF-2). Bỏ qua người vừa thao tác để admin tự gửi đơn
   * không tự nhận thông báo của chính mình.
   */
  async notifyAdmins(
    entry: Omit<NewNotification, 'userId'>,
    options: { exceptUserId?: string } = {},
    tx: Db | undefined = undefined,
  ): Promise<void> {
    const db = tx ?? this.db;
    const admins = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.role, 'admin'), eq(users.disabled, false)));

    const recipients = admins.filter((admin) => admin.id !== options.exceptUserId);
    if (recipients.length === 0) return;

    await db.insert(notifications).values(
      recipients.map((admin) => ({
        userId: admin.id,
        type: entry.type,
        title: entry.title,
        body: entry.body ?? null,
        requestId: entry.requestId ?? null,
      })),
    );
  }

  /** Danh sách thông báo của một người, mới nhất trước, kèm số chưa đọc. */
  async list(userId: string, options: { page: number; pageSize: number }) {
    const [rows, [{ unread }]] = await Promise.all([
      this.db
        .select()
        .from(notifications)
        .where(eq(notifications.userId, userId))
        .orderBy(desc(notifications.createdAt))
        .limit(options.pageSize)
        .offset((options.page - 1) * options.pageSize),
      this.db
        .select({ unread: sql<number>`count(*)::int` })
        .from(notifications)
        .where(and(eq(notifications.userId, userId), isNull(notifications.readAt))),
    ]);

    return { items: rows, unread, page: options.page, pageSize: options.pageSize };
  }

  /** Đánh dấu đã đọc. Lọc theo `userId` để không ai đọc hộ thông báo của người khác. */
  async markRead(userId: string, notificationId: string): Promise<boolean> {
    const updated = await this.db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(and(eq(notifications.id, notificationId), eq(notifications.userId, userId)))
      .returning({ id: notifications.id });
    return updated.length > 0;
  }

  async markAllRead(userId: string): Promise<number> {
    const updated = await this.db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)))
      .returning({ id: notifications.id });
    return updated.length;
  }
}
