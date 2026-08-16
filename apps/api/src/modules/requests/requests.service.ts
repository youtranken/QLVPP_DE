import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  canCancelRequest,
  checkRegistrationWindow,
  checkRequestLines,
  describeWindow,
  ErrorCode,
  formatRequestCode,
  periodForDate,
  type CatalogItemRule,
  type Role,
  type RuleViolation,
} from '@vpp/shared';
import { and, count, eq, inArray, sql } from 'drizzle-orm';
import type { AuthenticatedUser } from '../../auth/auth.service';
import { DB, type Db } from '../../infra/db/db.module';
import { isUniqueViolation } from '../../infra/db/pg-errors';
import { departments, items, requestItems, requests } from '../../infra/db/schema';
import { AuditService } from '../audit/audit.service';
import { NotificationsService, NOTIFICATION_TYPES } from '../notifications/notifications.service';
import { SettingsService } from '../settings/settings.service';
import type { CreateRequestDto, RequestLineDto } from './requests.dto';

/** Tên partial unique index thực thi "1 đơn hiệu lực/người/kỳ" (SDD §5). */
const ACTIVE_PER_PERIOD_INDEX = 'requests_active_per_period_idx';

/** Số lần thử lại khi hai đơn cùng kỳ giành cùng một số thứ tự mã đơn. */
const CODE_RETRY_LIMIT = 5;

/** Người ĐỨNG TÊN đơn — có thể khác người đang thao tác khi admin nhập hộ. */
export interface ChuDon {
  id: string;
  name: string | null;
  email: string | null;
  department: string | null;
}

/** Dòng đơn đã chuẩn hoá: tên/đơn vị lấy từ danh mục nếu có `itemId`. */
export interface ResolvedLine {
  itemId: string | null;
  name: string;
  unit: string;
  quantity: number;
  attachmentPath: string | null;
  note: string | null;
}

@Injectable()
export class RequestsService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly settings: SettingsService,
  ) {}

  /**
   * Tạo đơn cho chính người đang đăng nhập (CORE-2).
   * Mọi quy tắc đều kiểm ở SERVER tại THỜI ĐIỂM GỬI, kể cả khi giao diện đã chặn:
   * cửa sổ đăng ký, cấm A4 với nhân viên, SL ≤ max_qty, đơn không rỗng.
   */
  async create(user: AuthenticatedUser, dto: CreateRequestDto, thayMatCho?: ChuDon) {
    // Người CHỊU TRÁCH NHIỆM thao tác là `user` (admin khi nhập hộ); người SỞ HỮU
    // đơn là `chuDon`. Quy tắc (cửa sổ ngày, quyền chọn A4) áp theo NGƯỜI THAO
    // TÁC — admin nhập hộ thì admin chịu trách nhiệm về những gì mình nhập.
    const chuDon: ChuDon = thayMatCho ?? {
      id: user.id,
      name: user.name,
      email: user.email,
      department: user.department,
    };
    const nhapHo = chuDon.id !== user.id;

    // Đọc khung ngày MỘT LẦN rồi dùng cho cả kiểm tra lẫn tính kỳ: nếu đọc hai lần
    // mà admin sửa cài đặt đúng lúc đó thì đơn qua được cửa sổ nhưng lại rơi vào kỳ khác.
    const window = await this.settings.getWindow();
    const windowViolation = checkRegistrationWindow(user.role, window);
    if (windowViolation) throw new BadRequestException(windowViolation);

    const lines = await this.resolveLines(dto.lines, user.role);
    const period = periodForDate(window);
    const departmentId = await this.findDepartmentId(chuDon.department);

    const created = await this.insertWithGeneratedCode(period, async (tx, code) => {
      const [request] = await tx
        .insert(requests)
        .values({
          code,
          userId: chuDon.id,
          departmentId,
          period,
          status: 'submitted',
          note: dto.note ?? null,
        })
        .returning();

      await tx
        .insert(requestItems)
        .values(lines.map((line) => ({ ...line, requestId: request.id })));

      // Audit ghi TRONG transaction để đơn và dấu vết của nó cùng sống chết.
      // Ghi sau khi commit thì audit hỏng sẽ trả lỗi cho nhân viên trong khi đơn
      // đã nằm trong CSDL — họ tưởng gửi trượt, bấm lại và nhận "đã có đơn trong kỳ".
      await this.audit.log(
        {
          actor: { id: user.id, name: user.name },
          action: 'request.create',
          objectType: 'request',
          objectId: request.id,
          detail: {
            code: request.code,
            period,
            lineCount: lines.length,
            // Ghi rõ đơn này do ai nhập hộ ai — về sau có thắc mắc "tôi đâu có
            // đăng ký món này" thì nhật ký trả lời được.
            ...(nhapHo ? { nhapHoCho: chuDon.name ?? chuDon.email } : {}),
          },
        },
        tx,
      );
      return request;
    });

    // Thông báo nằm NGOÀI transaction và không bao giờ ném lỗi (xem
    // NotificationsService): chuông hỏng không được phép chặn người ta gửi đơn.
    const tenChuDon = chuDon.name ?? chuDon.email ?? 'Nhân viên';
    await this.notifications.notifyAdmins(
      {
        type: NOTIFICATION_TYPES.requestSubmitted,
        title: 'Có đơn đăng ký VPP mới',
        body: nhapHo
          ? `${user.name ?? 'Quản trị viên'} vừa nhập hộ đơn ${created.code} cho ${tenChuDon}.`
          : `${tenChuDon} vừa gửi đơn ${created.code}.`,
        requestId: created.id,
      },
      { exceptUserId: user.id },
    );

    // Người được nhập hộ PHẢI biết có đơn đứng tên mình — nếu không, họ chỉ phát
    // hiện khi hàng về, và không kịp nói là mình cần món khác.
    if (nhapHo) {
      await this.notifications.notify({
        userId: chuDon.id,
        type: NOTIFICATION_TYPES.requestSubmitted,
        title: 'Có đơn VPP đứng tên bạn',
        body: `${user.name ?? 'Quản trị viên'} đã nhập hộ đơn ${created.code} cho bạn.`,
        requestId: created.id,
      });
    }

    return this.getById(created.id, user);
  }

  /**
   * Chuẩn hoá dòng đơn và kiểm quy tắc.
   * Tên/đơn vị của dòng có `itemId` LẤY TỪ DANH MỤC — không nhận từ client, tránh
   * việc gửi lên tên khác để lách kiểm tra hoặc làm sai báo cáo.
   * Nhận `role` chứ không nhận cả user, để luồng điều chỉnh của admin dùng lại được.
   */
  async resolveLines(input: RequestLineDto[], role: Role): Promise<ResolvedLine[]> {
    const itemIds = [
      ...new Set(input.map((line) => line.itemId).filter((id): id is string => !!id)),
    ];
    const catalogItems = itemIds.length
      ? await this.db.select().from(items).where(inArray(items.id, itemIds))
      : [];
    const catalogById = new Map(catalogItems.map((item) => [item.id, item]));

    const rules = new Map<string, CatalogItemRule>(
      catalogItems.map((item) => [
        item.id,
        { id: item.id, adminOnly: item.adminOnly, maxQty: item.maxQty, active: item.active },
      ]),
    );

    // Tên dùng cho thông báo lỗi: ưu tiên tên trong danh mục cho dễ hiểu, nhưng
    // vẫn lùi về tên client gửi khi món không tồn tại — nếu không thì lỗi
    // "không tìm thấy món" sẽ hiện tên rỗng, người dùng không biết dòng nào sai.
    const named = input.map((line) => ({
      itemId: line.itemId ?? null,
      name:
        (line.itemId ? catalogById.get(line.itemId)?.name : undefined) ?? line.name?.trim() ?? '',
      quantity: line.quantity,
    }));

    const violations: RuleViolation[] = checkRequestLines(named, role, rules);

    // Dòng "Khác" bắt buộc có đơn vị tính; dòng theo danh mục thì lấy sẵn từ món.
    input.forEach((line, lineIndex) => {
      if (!line.itemId && !line.unit?.trim()) {
        violations.push({
          code: ErrorCode.VALIDATION,
          message: 'Dòng ngoài danh mục phải nhập đơn vị tính.',
          lineIndex,
        });
      }
    });

    if (violations.length > 0) {
      throw new BadRequestException({ code: violations[0].code, violations });
    }

    return input.map((line, index) => {
      const item = line.itemId ? catalogById.get(line.itemId) : undefined;
      return {
        itemId: line.itemId ?? null,
        name: item?.name ?? named[index].name,
        unit: item?.unit ?? line.unit!.trim(),
        quantity: line.quantity,
        attachmentPath: line.attachmentPath ?? null,
        note: line.note ?? null,
      };
    });
  }

  /** `departments` chỉ là cache tên phòng ban suy từ groups PMH ID. */
  private async findDepartmentId(name: string | null): Promise<string | null> {
    if (!name) return null;
    const [row] = await this.db
      .select({ id: departments.id })
      .from(departments)
      .where(eq(departments.name, name))
      .limit(1);
    if (row) return row.id;

    const [inserted] = await this.db
      .insert(departments)
      .values({ name })
      .onConflictDoNothing()
      .returning({ id: departments.id });
    return inserted?.id ?? null;
  }

  /**
   * Sinh mã đơn theo số thứ tự trong kỳ rồi ghi trong một transaction.
   * Hai người gửi cùng lúc có thể lấy trùng số ⇒ unique trên `code` chặn, thử lại.
   * Vi phạm partial unique (user_id, period) ⇒ đã có đơn hiệu lực trong kỳ (CORE-7).
   */
  private async insertWithGeneratedCode<T>(
    period: string,
    write: (tx: Db, code: string) => Promise<T>,
  ): Promise<T> {
    for (let attempt = 0; attempt < CODE_RETRY_LIMIT; attempt += 1) {
      const [{ value: used }] = await this.db
        .select({ value: count() })
        .from(requests)
        .where(eq(requests.period, period));
      const code = formatRequestCode(period, used + 1 + attempt);

      try {
        return await this.db.transaction((tx) => write(tx as unknown as Db, code));
      } catch (error) {
        if (isUniqueViolation(error, ACTIVE_PER_PERIOD_INDEX)) {
          throw new ConflictException({
            code: ErrorCode.DUPLICATE_REQUEST,
            message: 'Bạn đã có đơn đăng ký còn hiệu lực trong kỳ này.',
          });
        }
        if (isUniqueViolation(error, 'requests_code_unique')) continue; // trùng mã ⇒ thử số kế tiếp
        throw error;
      }
    }
    throw new ConflictException({
      code: ErrorCode.INTERNAL,
      message: 'Không sinh được mã đơn, vui lòng thử lại.',
    });
  }

  /** Đơn của tôi, mới nhất trước; lọc theo kỳ nếu có (CORE-9). */
  async listMine(user: AuthenticatedUser, period?: string) {
    const filter = period
      ? and(eq(requests.userId, user.id), eq(requests.period, period))
      : eq(requests.userId, user.id);

    const rows = await this.db
      .select()
      .from(requests)
      .where(filter)
      .orderBy(sql`${requests.createdAt} desc`);

    return this.attachLines(rows);
  }

  /** Chi tiết đơn. Nhân viên chỉ xem được đơn của chính mình. */
  async getById(requestId: string, user: AuthenticatedUser) {
    const [request] = await this.db
      .select()
      .from(requests)
      .where(eq(requests.id, requestId))
      .limit(1);
    if (!request) throw new NotFoundException({ code: ErrorCode.NOT_FOUND });
    if (user.role !== 'admin' && request.userId !== user.id) {
      throw new ForbiddenException({ code: ErrorCode.FORBIDDEN });
    }
    const [withLines] = await this.attachLines([request]);
    return withLines;
  }

  /**
   * Dòng thời gian của đơn (CORE-9b).
   *
   * Gọi `getById` trước để **dùng lại đúng luật xem đơn** — nhân viên chỉ xem
   * được đơn của mình, admin xem được mọi đơn. Viết lại phép kiểm ở đây là cách
   * chắc chắn để hai chỗ lệch nhau về sau.
   */
  async timeline(requestId: string, user: AuthenticatedUser) {
    await this.getById(requestId, user);
    return this.audit.timeline(requestId);
  }

  /**
   * Nhân viên huỷ đơn (CORE-8): chỉ khi đơn `submitted` VÀ còn trong cửa sổ đăng ký.
   * Huỷ xong được gửi đơn mới trong kỳ vì `cancelled` nằm ngoài partial unique index.
   */
  async cancel(requestId: string, user: AuthenticatedUser) {
    const [request] = await this.db
      .select()
      .from(requests)
      .where(eq(requests.id, requestId))
      .limit(1);
    if (!request) throw new NotFoundException({ code: ErrorCode.NOT_FOUND });
    if (request.userId !== user.id) throw new ForbiddenException({ code: ErrorCode.FORBIDDEN });

    const window = await this.settings.getWindow();
    if (!canCancelRequest(request.status, window)) {
      throw new ConflictException({
        code: ErrorCode.VALIDATION,
        message:
          request.status === 'submitted'
            ? `Đã hết hạn đăng ký (chỉ nhận ${describeWindow(window)} hằng tháng), không huỷ được đơn. Liên hệ quản trị viên.`
            : 'Chỉ huỷ được đơn đang ở trạng thái "đã gửi".',
      });
    }

    await this.db
      .update(requests)
      .set({ status: 'cancelled', updatedAt: new Date() })
      .where(eq(requests.id, requestId));

    await this.audit.log({
      actor: { id: user.id, name: user.name },
      action: 'request.cancel',
      objectType: 'request',
      objectId: requestId,
      detail: { code: request.code },
    });

    return this.getById(requestId, user);
  }

  /** Gắn danh sách dòng vào các đơn bằng MỘT truy vấn, tránh N+1. */
  async attachLines<T extends { id: string }>(rows: T[]) {
    if (rows.length === 0) return [];
    const lines = await this.db
      .select()
      .from(requestItems)
      .where(
        inArray(
          requestItems.requestId,
          rows.map((row) => row.id),
        ),
      );

    const byRequest = new Map<string, (typeof lines)[number][]>();
    for (const line of lines) {
      const bucket = byRequest.get(line.requestId);
      if (bucket) bucket.push(line);
      else byRequest.set(line.requestId, [line]);
    }
    return rows.map((row) => ({ ...row, items: byRequest.get(row.id) ?? [] }));
  }
}
