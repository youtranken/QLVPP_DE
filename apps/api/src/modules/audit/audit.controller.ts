import { Controller, Get, Query } from '@nestjs/common';
import { z } from 'zod';
import { Roles } from '../../auth/roles.decorator';
import { ZodPipe } from '../../infra/validation/zod.pipe';
import { AuditService } from './audit.service';

const ListQuerySchema = z.object({
  action: z.string().trim().max(60).optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
});

/** Nhật ký audit — chỉ admin (ADMIN-5). */
@Roles('admin')
@Controller('api/admin/audit')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  list(@Query(new ZodPipe(ListQuerySchema)) query: z.infer<typeof ListQuerySchema>) {
    return this.audit.list(query);
  }
}
