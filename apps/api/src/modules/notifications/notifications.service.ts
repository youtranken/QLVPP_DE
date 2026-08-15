import { Inject, Injectable, Logger } from '@nestjs/common';
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

/**
 * Thông báo TRONG APP (chuông) — không gửi email (SDD §0 mục 11).
 *
 * **Thông báo là lớp tiện lợi, KHÔNG phải nguồn sự thật.** Nguồn sự thật là danh
 * sách đơn ở màn quản trị. Vì vậy mọi hàm gửi ở đây **không bao giờ ném lỗi**:
 * chuông hỏng không được phép làm nhân viên không gửi được đơn hay admin không
 * duyệt được. Lỗi được ghi log ở mức `error` để còn biết mà xử lý.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(@Inject(DB) private readonly db: Db) {}

  async notify(entry: NewNotification, tx: Db | undefined = undefined): Promise<void> {
    await this.ghi(
      tx ?? this.db,
      [
        {
          userId: entry.userId,
          type: entry.type,
          title: entry.title,
          body: entry.body ?? null,
          requestId: entry.requestId ?? null,
        },
      ],
      entry.type,
    );
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

    let admins: { id: string }[];
    try {
      admins = await db
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.role, 'admin'), eq(users.disabled, false)));
    } catch (error) {
      this.logger.error(`Không đọc được danh sách quản trị viên: ${(error as Error).message}`);
      return;
    }

    if (admins.length === 0) {
      // Đây gần như luôn là ánh xạ nhóm sai: tên nhóm ở PMH ID khác VPP_ADMIN_GROUP
      // nên KHÔNG AI có vai trò admin. Trước đây chỗ này im lặng bỏ qua, nghĩa là
      // đơn cứ vào mà không ai được báo, và không có dấu vết nào để lần ra.
      this.logger.error(
        `Không có quản trị viên nào để nhận thông báo "${entry.type}". ` +
          'Kiểm tra VPP_ADMIN_GROUP có khớp tên nhóm ở PMH ID không (RUNBOOK §7).',
      );
      return;
    }

    const recipients = admins.filter((admin) => admin.id !== options.exceptUserId);
    // Chỉ có một admin và chính họ vừa thao tác ⇒ không cần tự báo cho mình.
    if (recipients.length === 0) return;

    await this.ghi(
      db,
      recipients.map((admin) => ({
        userId: admin.id,
        type: entry.type,
        title: entry.title,
        body: entry.body ?? null,
        requestId: entry.requestId ?? null,
      })),
      entry.type,
    );
  }

  /** Ghi thông báo, nuốt lỗi có ghi log — xem ghi chú ở đầu lớp. */
  private async ghi(
    db: Db,
    rows: {
      userId: string;
      type: string;
      title: string;
      body: string | null;
      requestId: string | null;
    }[],
    loai: string,
  ): Promise<void> {
    try {
      await db.insert(notifications).values(rows);
    } catch (error) {
      this.logger.error(
        `Không ghi được ${rows.length} thông báo "${loai}": ${(error as Error).message}. ` +
          'Nghiệp vụ vẫn được ghi nhận; người nhận sẽ không thấy chuông.',
      );
    }
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
