import {
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ErrorCode } from '@vpp/shared';
import { z } from 'zod';
import type { AuthenticatedUser } from '../../auth/auth.service';
import { CurrentUser } from '../../auth/roles.decorator';
import { ZodPipe } from '../../infra/validation/zod.pipe';
import { NotificationsService } from './notifications.service';

const ListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
});

/** Chuông thông báo trong app (NOTIF-1/2). Ai cũng chỉ thấy thông báo của mình. */
@Controller('api/notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodPipe(ListQuerySchema)) query: z.infer<typeof ListQuerySchema>,
  ) {
    return this.notifications.list(user.id, query);
  }

  @Post(':id/read')
  @HttpCode(204)
  async markRead(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    const updated = await this.notifications.markRead(user.id, id);
    // Không tìm thấy = không tồn tại HOẶC của người khác — trả 404 cho cả hai để
    // không tiết lộ sự tồn tại của thông báo người khác.
    if (!updated) throw new NotFoundException({ code: ErrorCode.NOT_FOUND });
  }

  @Post('read-all')
  async markAllRead(@CurrentUser() user: AuthenticatedUser): Promise<{ updated: number }> {
    return { updated: await this.notifications.markAllRead(user.id) };
  }
}
