import { Controller, Get, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { z } from 'zod';
import { Roles } from '../../auth/roles.decorator';
import { parseEnv } from '../../infra/config/env';
import { ZodPipe } from '../../infra/validation/zod.pipe';
import { PeriodSchema } from '../requests/requests.dto';
import { buildRequestsWorkbook, reportFileName } from './excel.builder';
import { ReportsService } from './reports.service';

const StatsQuerySchema = z.object({
  from: PeriodSchema.optional(),
  to: PeriodSchema.optional(),
});

const ExportQuerySchema = z.object({
  period: PeriodSchema.optional(),
  departmentId: z.string().uuid().optional(),
});

/** Thống kê & xuất báo cáo — chỉ admin (REPORT-1…3). */
@Roles('admin')
@Controller('api')
export class ReportsController {
  private readonly config = parseEnv();

  constructor(private readonly reports: ReportsService) {}

  @Get('admin/stats')
  stats(@Query(new ZodPipe(StatsQuerySchema)) query: z.infer<typeof StatsQuerySchema>) {
    return this.reports.stats(query);
  }

  /**
   * Xuất Excel trình ký (REPORT-2).
   * Dựng trong bộ nhớ rồi gửi một lần — báo cáo một kỳ của ≤500 người là nhỏ,
   * không cần stream.
   */
  @Get('export/requests.xlsx')
  async exportXlsx(
    @Query(new ZodPipe(ExportQuerySchema)) query: z.infer<typeof ExportQuerySchema>,
    @Res() res: Response,
  ): Promise<void> {
    const period = await this.reports.resolvePeriod(query.period);
    const [summary, detail] = await Promise.all([
      this.reports.summaryByItem(period, query.departmentId),
      this.reports.detailByPerson(period, query.departmentId),
    ]);

    const buffer = await buildRequestsWorkbook(
      {
        orgName: this.config.ORG_NAME,
        period,
        createdAt: new Date(),
        // Chỉ ghi tên phòng ban lên tiêu đề KHI báo cáo được lọc theo phòng ban —
        // báo cáo toàn công ty mà ghi tên một phòng thì sai lệch khi trình ký.
        departmentName: query.departmentId
          ? (detail.find((line) => line.departmentName)?.departmentName ?? null)
          : null,
      },
      summary,
      detail,
    );

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${reportFileName(period)}"`);
    res.send(buffer);
  }
}
