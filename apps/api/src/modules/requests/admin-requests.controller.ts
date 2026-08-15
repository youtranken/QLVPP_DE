import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import type { AuthenticatedUser } from '../../auth/auth.service';
import { CurrentUser, Roles } from '../../auth/roles.decorator';
import { ZodPipe } from '../../infra/validation/zod.pipe';
import { AdminRequestsService } from './admin-requests.service';
import {
  AdjustRequestSchema,
  DeliverLineSchema,
  ListRequestsQuerySchema,
  PeriodSchema,
  RejectRequestSchema,
  type AdjustRequestDto,
  type DeliverLineDto,
  type ListRequestsQuery,
  type RejectRequestDto,
} from './requests.dto';

/**
 * Xử lý đơn — chỉ admin (SDD §2, §7).
 * Đặt ở `/api/admin/requests` để tách hẳn khỏi `/api/requests` của nhân viên,
 * tránh nhầm lẫn quyền khi đọc route.
 */
@Roles('admin')
@Controller('api/admin/requests')
export class AdminRequestsController {
  constructor(private readonly admin: AdminRequestsService) {}

  @Get()
  list(@Query(new ZodPipe(ListRequestsQuerySchema)) query: ListRequestsQuery) {
    return this.admin.list(query);
  }

  /** Số liệu tổng quan của kỳ đang nhận — hàng thẻ ở trang chủ (CORE-10c). */
  @Get('overview')
  overview() {
    return this.admin.overview();
  }

  /** Danh sách theo TỪNG MÓN — bảng ở trang chủ quản trị (CORE-10b). */
  @Get('items')
  listItems(@Query(new ZodPipe(ListRequestsQuerySchema)) query: ListRequestsQuery) {
    return this.admin.listItems(query);
  }

  /** Tổng hợp theo món trong kỳ — cơ sở cho báo cáo Excel (REPORT-1). */
  @Get('summary')
  summary(
    @Query('period', new ZodPipe(PeriodSchema.optional())) period?: string,
    @Query('departmentId') departmentId?: string,
  ) {
    return this.admin.summary(period, departmentId);
  }

  /**
   * Một đơn kèm tên người/phòng ban, cho ngăn kéo duyệt.
   *
   * PHẢI khai SAU mọi đường dẫn tĩnh (`items`, `summary`): Nest so khớp theo thứ
   * tự khai báo, đặt trước thì `:id` nuốt luôn `/summary` và biến nó thành lỗi
   * "id không phải UUID".
   */
  @Get(':id')
  getOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.admin.getOne(id);
  }

  @Post(':id/approve')
  approve(@CurrentUser() admin: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.admin.approve(id, admin);
  }

  @Post(':id/reject')
  reject(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(RejectRequestSchema)) dto: RejectRequestDto,
  ) {
    return this.admin.reject(id, admin, dto.reason);
  }

  @Post(':id/items/:lineId/deliver')
  deliverLine(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('lineId', ParseUUIDPipe) lineId: string,
    @Body(new ZodPipe(DeliverLineSchema)) dto: DeliverLineDto,
  ) {
    return this.admin.deliverLine(id, lineId, admin, dto);
  }

  @Post(':id/deliver-all')
  deliverAll(@CurrentUser() admin: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.admin.deliverAll(id, admin, true);
  }

  @Post(':id/undeliver-all')
  undeliverAll(@CurrentUser() admin: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.admin.deliverAll(id, admin, false);
  }

  /** Điều chỉnh đặc biệt: bỏ qua cửa sổ ngày và lệnh cấm A4 (CORE-13). */
  @Patch(':id')
  adjust(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(AdjustRequestSchema)) dto: AdjustRequestDto,
  ) {
    return this.admin.adjust(id, admin, dto);
  }
}
