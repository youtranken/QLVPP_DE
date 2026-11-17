import { Controller, Get, Param, Query } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';
import { ClockService } from '../../common/clock.service';
import { Roles } from '../auth/roles.decorator';
import { PeriodsService } from '../periods/periods.service';
import { UsersService } from '../users/users.service';
import { HistoryService } from './history.service';
import { userNotFound } from './request-errors';

export class UserHistoryQuery {
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year!: number;
}

// Chỉ đọc, không audit — popup Lịch sử đặt hàng của một nhân viên
@Controller('admin')
@Roles('admin', 'sa')
export class AdminUserHistoryController {
  constructor(
    private readonly history: HistoryService,
    private readonly users: UsersService,
    private readonly periods: PeriodsService,
    private readonly clock: ClockService,
  ) {}

  @Get('users/:sub/requests')
  async list(@Param('sub') sub: string, @Query() query: UserHistoryQuery) {
    const user = await this.users.findBySub(sub);
    if (!user) throw userNotFound();
    return {
      sub,
      full_name: user.fullName,
      year: query.year,
      items: await this.history.forYear(sub, query.year),
      summary: await this.history.recentSummary(
        sub,
        (await this.periods.openPeriod(undefined, this.clock.now())).ym,
      ),
    };
  }
}
