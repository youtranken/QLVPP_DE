import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { canDeliverRequest, ErrorCode, periodForDate } from '@vpp/shared';
import { and, asc, desc, eq, sql, type SQL } from 'drizzle-orm';
import type { AuthenticatedUser } from '../../auth/auth.service';
import { DB, type Db } from '../../infra/db/db.module';
import { departments, items, requestItems, requests, users } from '../../infra/db/schema';
import { AuditService } from '../audit/audit.service';
import { NotificationsService, NOTIFICATION_TYPES } from '../notifications/notifications.service';
import { SettingsService } from '../settings/settings.service';
import type { AdjustRequestDto, DeliverLineDto, ListRequestsQuery } from './requests.dto';
import { RequestsService } from './requests.service';

type RequestRow = typeof requests.$inferSelect;

@Injectable()
export class AdminRequestsService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly requests: RequestsService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly settings: SettingsService,
  ) {}

  /**
   * Số liệu tổng quan của KỲ ĐANG NHẬN, cho trang chủ quản trị.
   *
   * Bốn con số trả lời đúng câu hỏi admin hỏi khi mở trang: *có gì đang chờ tôi?*
   * Cố ý KHÔNG kèm xu hướng nhiều kỳ — thứ đó xem mỗi tháng một lần và đã có
   * riêng ở Bảng điều khiển.
   */
  async overview() {
    const period = periodForDate(await this.settings.getWindow());
    const trongKy = eq(requests.period, period);

    const [[theoTrangThai], [mon], [nguoi], [daDangKy]] = await Promise.all([
      // Việc tồn đọng tính trên MỌI KỲ, không chỉ kỳ hiện tại: đơn kỳ trước chưa
      // duyệt vẫn là việc phải làm. Bó vào kỳ hiện tại sẽ ra cảnh "0 đơn chờ
      // duyệt" nằm cạnh một bảng đầy đơn chờ duyệt — đã bắt được lúc chạy thử.
      this.db
        .select({
          choDuyet: sql<number>`count(*) filter (where ${requests.status} = 'submitted')::int`,
          // "Chờ giao" = đã duyệt nhưng chưa giao đủ; đơn `delivered` là xong việc.
          choGiao: sql<number>`count(*) filter (where ${requests.status} = 'approved')::int`,
        })
        .from(requests),
      this.db
        .select({ tongMon: sql<number>`coalesce(sum(${requestItems.quantity}), 0)::int` })
        .from(requestItems)
        .innerJoin(requests, eq(requests.id, requestItems.requestId))
        .where(and(trongKy, sql`${requests.status} in ('submitted','approved','delivered')`)),
      // Người bị khoá ở PMH ID không còn là người "chưa đăng ký" — đừng tính vào
      // mẫu số rồi bắt admin đi hỏi một người đã nghỉ việc.
      this.db
        .select({ tong: sql<number>`count(*)::int` })
        .from(users)
        .where(eq(users.disabled, false)),
      this.db
        .select({ so: sql<number>`count(distinct ${requests.userId})::int` })
        .from(requests)
        .where(and(trongKy, sql`${requests.status} in ('submitted','approved','delivered')`)),
    ]);

    return {
      period,
      choDuyet: theoTrangThai.choDuyet,
      choGiao: theoTrangThai.choGiao,
      tongMon: mon.tongMon,
      tongNguoi: nguoi.tong,
      daDangKy: daDangKy.so,
      chuaDangKy: Math.max(0, nguoi.tong - daDangKy.so),
    };
  }

  /**
   * Danh sách theo TỪNG MÓN được đăng ký — mỗi dòng một món, không phải một đơn
   * (CORE-10b). Dùng cho bảng ở trang chủ quản trị: nhìn được ngay phòng nào xin
   * món gì, bao nhiêu, mà không phải mở từng đơn.
   *
   * `requestId` trả kèm để bấm vào dòng là mở đúng đơn chứa nó mà duyệt — việc
   * duyệt vẫn theo cả đơn.
   */
  async listItems(query: ListRequestsQuery) {
    const filters: SQL[] = [];
    if (query.period) filters.push(eq(requests.period, query.period));
    if (query.departmentId) filters.push(eq(requests.departmentId, query.departmentId));
    if (query.status) filters.push(eq(requests.status, query.status));
    const where = filters.length ? and(...filters) : undefined;

    const [rows, [{ total }]] = await Promise.all([
      this.db
        .select({
          id: requestItems.id,
          requestId: requests.id,
          requestCode: requests.code,
          period: requests.period,
          status: requests.status,
          createdAt: requests.createdAt,
          // Mã lấy từ DANH MỤC chứ không chụp vào dòng đơn: admin sửa mã thì báo
          // cáo phải hiện mã hiện hành. Dòng "Khác" không có món nên không có mã.
          itemCode: items.code,
          name: requestItems.name,
          unit: requestItems.unit,
          quantity: requestItems.quantity,
          deliveredQty: requestItems.deliveredQty,
          userName: users.name,
          departmentName: departments.name,
        })
        .from(requestItems)
        .innerJoin(requests, eq(requests.id, requestItems.requestId))
        .innerJoin(users, eq(users.id, requests.userId))
        .leftJoin(items, eq(items.id, requestItems.itemId))
        .leftJoin(departments, eq(departments.id, requests.departmentId))
        .where(where)
        .orderBy(desc(requests.createdAt), asc(requestItems.name))
        .limit(query.pageSize)
        .offset((query.page - 1) * query.pageSize),
      this.db
        .select({ total: sql<number>`count(*)::int` })
        .from(requestItems)
        .innerJoin(requests, eq(requests.id, requestItems.requestId))
        .where(where),
    ]);

    return { items: rows, total, page: query.page, pageSize: query.pageSize };
  }

  /**
   * Một đơn kèm tên người đăng ký và phòng ban — đúng hình dạng mà màn quản trị
   * cần. `GET /requests/:id` cũng trả về đơn nhưng KHÔNG có mấy trường này, nên
   * bảng theo món ở trang chủ không dùng lại được.
   */
  async getOne(requestId: string) {
    const [row] = await this.db
      .select({
        request: requests,
        userName: users.name,
        userEmail: users.email,
        departmentName: departments.name,
      })
      .from(requests)
      .innerJoin(users, eq(users.id, requests.userId))
      .leftJoin(departments, eq(departments.id, requests.departmentId))
      .where(eq(requests.id, requestId))
      .limit(1);

    if (!row) throw new NotFoundException({ code: ErrorCode.NOT_FOUND });

    const [withLines] = await this.requests.attachLines([row.request]);
    return {
      ...withLines,
      userName: row.userName,
      userEmail: row.userEmail,
      departmentName: row.departmentName,
    };
  }

  /** Danh sách mọi đơn, lọc + phân trang (CORE-10). */
  async list(query: ListRequestsQuery) {
    const filters: SQL[] = [];
    if (query.period) filters.push(eq(requests.period, query.period));
    if (query.departmentId) filters.push(eq(requests.departmentId, query.departmentId));
    if (query.status) filters.push(eq(requests.status, query.status));
    const where = filters.length ? and(...filters) : undefined;

    const [rows, [{ total }]] = await Promise.all([
      this.db
        .select({
          request: requests,
          userName: users.name,
          userEmail: users.email,
          departmentName: departments.name,
        })
        .from(requests)
        .innerJoin(users, eq(users.id, requests.userId))
        .leftJoin(departments, eq(departments.id, requests.departmentId))
        .where(where)
        .orderBy(desc(requests.createdAt))
        .limit(query.pageSize)
        .offset((query.page - 1) * query.pageSize),
      this.db
        .select({ total: sql<number>`count(*)::int` })
        .from(requests)
        .where(where),
    ]);

    const withLines = await this.requests.attachLines(rows.map((row) => row.request));
    const extraById = new Map(rows.map((row) => [row.request.id, row]));

    return {
      items: withLines.map((request) => ({
        ...request,
        userName: extraById.get(request.id)?.userName ?? null,
        userEmail: extraById.get(request.id)?.userEmail ?? null,
        departmentName: extraById.get(request.id)?.departmentName ?? null,
      })),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  /**
   * Tổng hợp theo món trong một kỳ (REPORT-1).
   * Gộp theo (tên, đơn vị) vì cùng tên khác đơn vị là hai dòng khác nhau.
   * **Loại trừ đơn `cancelled` và `rejected`** — chúng chỉ còn giá trị lịch sử.
   */
  async summary(period: string | undefined, departmentId?: string) {
    const targetPeriod = period ?? periodForDate(await this.settings.getWindow());
    const filters: SQL[] = [
      eq(requests.period, targetPeriod),
      sql`${requests.status} in ('submitted','approved','delivered')`,
    ];
    if (departmentId) filters.push(eq(requests.departmentId, departmentId));

    const rows = await this.db
      .select({
        name: requestItems.name,
        unit: requestItems.unit,
        totalQty: sql<number>`sum(${requestItems.quantity})::int`,
        deliveredQty: sql<number>`sum(${requestItems.deliveredQty})::int`,
        requestCount: sql<number>`count(distinct ${requests.id})::int`,
      })
      .from(requestItems)
      .innerJoin(requests, eq(requests.id, requestItems.requestId))
      .where(and(...filters))
      .groupBy(requestItems.name, requestItems.unit)
      .orderBy(requestItems.name);

    return { period: targetPeriod, items: rows };
  }

  /** Duyệt đơn (CORE-11). Chỉ đơn còn `submitted` — tránh duyệt đè lên thay đổi khác. */
  async approve(requestId: string, admin: AuthenticatedUser) {
    const request = await this.requireStatus(requestId, ['submitted']);

    await this.db
      .update(requests)
      .set({
        status: 'approved',
        approvedBy: admin.id,
        approvedAt: new Date(),
        reviewedBy: admin.id,
        rejectReason: null,
        updatedAt: new Date(),
      })
      .where(eq(requests.id, requestId));

    await this.audit.log({
      actor: { id: admin.id, name: admin.name },
      action: 'request.approve',
      objectType: 'request',
      objectId: requestId,
      detail: { code: request.code },
    });

    await this.notifications.notify({
      userId: request.userId,
      type: NOTIFICATION_TYPES.requestApproved,
      title: 'Đơn VPP đã được duyệt',
      body: `Đơn ${request.code} đã được duyệt.`,
      requestId,
    });

    return this.requests.getById(requestId, admin);
  }

  /** Từ chối kèm lý do BẮT BUỘC (CORE-12); nhân viên được gửi đơn mới trong kỳ. */
  async reject(requestId: string, admin: AuthenticatedUser, reason: string) {
    const request = await this.requireStatus(requestId, ['submitted']);

    await this.db
      .update(requests)
      .set({
        status: 'rejected',
        rejectReason: reason,
        reviewedBy: admin.id,
        updatedAt: new Date(),
      })
      .where(eq(requests.id, requestId));

    await this.audit.log({
      actor: { id: admin.id, name: admin.name },
      action: 'request.reject',
      objectType: 'request',
      objectId: requestId,
      detail: { code: request.code, reason },
    });

    await this.notifications.notify({
      userId: request.userId,
      type: NOTIFICATION_TYPES.requestRejected,
      title: 'Đơn VPP bị từ chối',
      body: `Đơn ${request.code} bị từ chối. Lý do: ${reason}`,
      requestId,
    });

    return this.requests.getById(requestId, admin);
  }

  /** Xác nhận giao MỘT dòng (CORE-14). Chỉ đơn đã duyệt mới được giao (BR-09). */
  async deliverLine(
    requestId: string,
    lineId: string,
    admin: AuthenticatedUser,
    dto: DeliverLineDto,
  ) {
    const request = await this.requireDeliverable(requestId);

    const [line] = await this.db
      .select()
      .from(requestItems)
      .where(and(eq(requestItems.id, lineId), eq(requestItems.requestId, requestId)))
      .limit(1);
    if (!line) throw new NotFoundException({ code: ErrorCode.NOT_FOUND });

    const deliveredQty = dto.delivered ? (dto.deliveredQty ?? line.quantity) : 0;
    if (deliveredQty > line.quantity) {
      throw new ConflictException({
        code: ErrorCode.QTY_INVALID,
        message: `Số lượng giao (${deliveredQty}) vượt số đã đăng ký (${line.quantity}).`,
      });
    }

    await this.db
      .update(requestItems)
      .set({ delivered: dto.delivered, deliveredQty })
      .where(eq(requestItems.id, lineId));

    await this.syncDeliveryStatus(requestId, request.code);
    await this.audit.log({
      actor: { id: admin.id, name: admin.name },
      action: 'request.deliver_line',
      objectType: 'request_item',
      objectId: lineId,
      detail: { code: request.code, line: line.name, delivered: dto.delivered, deliveredQty },
    });

    return this.requests.getById(requestId, admin);
  }

  /** Giao TOÀN BỘ hoặc hoàn tác cả đơn (CORE-15). */
  async deliverAll(requestId: string, admin: AuthenticatedUser, delivered: boolean) {
    const request = await this.requireDeliverable(requestId);

    await this.db
      .update(requestItems)
      .set(
        delivered
          ? { delivered: true, deliveredQty: sql`${requestItems.quantity}` }
          : { delivered: false, deliveredQty: 0 },
      )
      .where(eq(requestItems.requestId, requestId));

    await this.syncDeliveryStatus(requestId, request.code);
    await this.audit.log({
      actor: { id: admin.id, name: admin.name },
      action: delivered ? 'request.deliver_all' : 'request.undeliver_all',
      objectType: 'request',
      objectId: requestId,
      detail: { code: request.code },
    });

    return this.requests.getById(requestId, admin);
  }

  /**
   * Đồng bộ trạng thái đơn theo các dòng: mọi dòng đã giao ⇒ đơn `delivered`,
   * ngược lại quay về `approved` (CORE-14/15). Chỉ báo cho nhân viên khi đơn
   * VỪA chuyển sang `delivered`, tránh spam mỗi lần tick một dòng.
   */
  private async syncDeliveryStatus(requestId: string, code: string): Promise<void> {
    const [{ total, done }] = await this.db
      .select({
        total: sql<number>`count(*)::int`,
        done: sql<number>`count(*) filter (where ${requestItems.delivered})::int`,
      })
      .from(requestItems)
      .where(eq(requestItems.requestId, requestId));

    const allDelivered = total > 0 && done === total;
    const [current] = await this.db
      .select({ status: requests.status, userId: requests.userId })
      .from(requests)
      .where(eq(requests.id, requestId))
      .limit(1);

    const nextStatus = allDelivered ? 'delivered' : 'approved';
    if (current.status === nextStatus) return;

    await this.db
      .update(requests)
      .set({
        status: nextStatus,
        deliveredAt: allDelivered ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(requests.id, requestId));

    if (allDelivered) {
      await this.notifications.notify({
        userId: current.userId,
        type: NOTIFICATION_TYPES.requestDelivered,
        title: 'Đơn VPP đã giao đủ',
        body: `Đơn ${code} đã được giao đầy đủ.`,
        requestId,
      });
    }
  }

  /**
   * Điều chỉnh đặc biệt (CORE-13): admin thay danh sách dòng, **bỏ qua** cửa sổ ngày
   * và lệnh cấm A4 vì chính admin là người chịu trách nhiệm. Ghi audit đầy đủ
   * dòng trước/sau để đối soát được.
   */
  async adjust(requestId: string, admin: AuthenticatedUser, dto: AdjustRequestDto) {
    const request = await this.requireStatus(requestId, ['submitted', 'approved', 'delivered']);
    const before = await this.db
      .select()
      .from(requestItems)
      .where(eq(requestItems.requestId, requestId));

    // Dùng lại đúng bộ kiểm của luồng tạo đơn, nhưng với vai trò admin
    // (nên A4 được phép; SL vẫn phải ≤ max_qty và món phải còn active).
    const lines = await this.requests.resolveLines(dto.lines, 'admin');

    await this.db.transaction(async (tx) => {
      await tx.delete(requestItems).where(eq(requestItems.requestId, requestId));
      await tx.insert(requestItems).values(lines.map((line) => ({ ...line, requestId })));
      await tx
        .update(requests)
        .set({
          note: dto.note ?? request.note,
          // Đơn đã giao mà bị sửa dòng thì không còn "đã giao đủ" nữa.
          status: request.status === 'delivered' ? 'approved' : request.status,
          deliveredAt: request.status === 'delivered' ? null : request.deliveredAt,
          updatedAt: new Date(),
        })
        .where(eq(requests.id, requestId));
    });

    await this.audit.log({
      actor: { id: admin.id, name: admin.name },
      action: 'request.adjust',
      objectType: 'request',
      objectId: requestId,
      detail: {
        code: request.code,
        reason: dto.reason ?? null,
        before: before.map((l) => ({ name: l.name, quantity: l.quantity })),
        after: lines.map((l) => ({ name: l.name, quantity: l.quantity })),
      },
    });

    await this.notifications.notify({
      userId: request.userId,
      type: NOTIFICATION_TYPES.requestAdjusted,
      title: 'Đơn VPP được điều chỉnh',
      body: `Quản trị viên đã điều chỉnh đơn ${request.code}.`,
      requestId,
    });

    return this.requests.getById(requestId, admin);
  }

  /** Đọc đơn và yêu cầu đúng trạng thái — chặn race khi hai admin thao tác cùng lúc. */
  private async requireStatus(
    requestId: string,
    allowed: RequestRow['status'][],
  ): Promise<RequestRow> {
    const [request] = await this.db
      .select()
      .from(requests)
      .where(eq(requests.id, requestId))
      .limit(1);
    if (!request) throw new NotFoundException({ code: ErrorCode.NOT_FOUND });
    if (!allowed.includes(request.status)) {
      throw new ConflictException({
        code: ErrorCode.VALIDATION,
        message: `Trạng thái đơn đã thay đổi (hiện là "${request.status}"), vui lòng tải lại.`,
      });
    }
    return request;
  }

  private async requireDeliverable(requestId: string): Promise<RequestRow> {
    const [request] = await this.db
      .select()
      .from(requests)
      .where(eq(requests.id, requestId))
      .limit(1);
    if (!request) throw new NotFoundException({ code: ErrorCode.NOT_FOUND });
    if (!canDeliverRequest(request.status)) {
      throw new ConflictException({
        code: ErrorCode.VALIDATION,
        message: 'Chỉ đơn ĐÃ DUYỆT mới được xác nhận giao.',
      });
    }
    return request;
  }
}
