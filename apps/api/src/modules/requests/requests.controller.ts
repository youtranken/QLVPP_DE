import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import type { AuthenticatedUser } from '../../auth/auth.service';
import { CurrentUser } from '../../auth/roles.decorator';
import { ZodPipe } from '../../infra/validation/zod.pipe';
import { CreateRequestSchema, PeriodSchema, type CreateRequestDto } from './requests.dto';
import { RequestsService } from './requests.service';

/** Đơn đăng ký của chính người dùng — SDD §7. */
@Controller('api/requests')
export class RequestsController {
  constructor(private readonly requests: RequestsService) {}

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodPipe(CreateRequestSchema)) dto: CreateRequestDto,
  ) {
    return this.requests.create(user, dto);
  }

  @Get('mine')
  listMine(
    @CurrentUser() user: AuthenticatedUser,
    @Query('period', new ZodPipe(PeriodSchema.optional())) period?: string,
  ) {
    return this.requests.listMine(user, period);
  }

  @Get(':id')
  getById(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.requests.getById(id, user);
  }

  /** Huỷ đơn — chỉ khi đơn `submitted` và còn trong ngày 1–10 (FR-23). */
  @Delete(':id')
  cancel(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.requests.cancel(id, user);
  }
}
