import { Controller, Get, Injectable, Logger, Post, Query } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { z } from 'zod';
import type { AuthenticatedUser } from '../../auth/auth.service';
import { CurrentUser, Roles } from '../../auth/roles.decorator';
import { parseEnv } from '../../infra/config/env';
import { ZodPipe } from '../../infra/validation/zod.pipe';
import { DirectoryService } from './directory.service';

const ListQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(200).optional().default(50),
});

/** Danh bạ nhân viên — chỉ admin (ADMIN-3/4). Không tạo/sửa: danh tính do PMH ID quản. */
@Roles('admin')
@Controller('api/admin')
export class DirectoryController {
  constructor(private readonly directory: DirectoryService) {}

  @Get('users')
  listUsers(@Query(new ZodPipe(ListQuerySchema)) query: z.infer<typeof ListQuerySchema>) {
    return this.directory.listUsers(query);
  }

  /** Nút "Đồng bộ ngay". */
  @Post('directory-sync')
  sync(@CurrentUser() admin: AuthenticatedUser) {
    return this.directory.sync({ id: admin.id, name: admin.name });
  }
}

/** Phòng ban suy từ groups PMH ID — mọi người đã đăng nhập đều xem được (để lọc). */
@Controller('api/departments')
export class DepartmentsController {
  constructor(private readonly directory: DirectoryService) {}

  @Get()
  list() {
    return this.directory.listDepartments();
  }
}

/**
 * Job đồng bộ danh bạ chạy trong tiến trình api (ADR-0008: không Redis/worker riêng).
 * Lỗi được nuốt tại đây — job nền không được làm sập tiến trình; lần chạy sau tự thử lại.
 */
@Injectable()
export class DirectorySyncJob {
  private readonly logger = new Logger(DirectorySyncJob.name);

  constructor(private readonly directory: DirectoryService) {}

  @Interval('directory-sync', parseEnv().DIRECTORY_SYNC_MINUTES * 60 * 1000)
  async run(): Promise<void> {
    try {
      await this.directory.sync(null);
    } catch (error) {
      this.logger.warn(`Đồng bộ danh bạ định kỳ thất bại: ${(error as Error).message}`);
    }
  }
}
