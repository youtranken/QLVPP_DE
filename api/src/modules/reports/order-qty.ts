import { BadRequestException } from '@nestjs/common';
import type { MonthReport } from './report.types';
import { ORDER_QTY_MAX } from './snapshot.dto';

const isOrderQty = (v: unknown): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= ORDER_QTY_MAX;

export function resolveOrderQty(
  report: MonthReport,
  input: Record<string, unknown> = {},
): Record<string, number> {
  const rows = [...report.byItem, ...report.custom];
  const keys = new Set(rows.map((r) => r.key));
  const bad = Object.entries(input)
    .filter(([key, v]) => !keys.has(key) || !isOrderQty(v))
    .map(([key]) => `order_qty.${key}`);
  if (bad.length) {
    throw new BadRequestException({
      code: 'VALIDATION',
      message: `order_qty phải là số nguyên 0…${ORDER_QTY_MAX} của hàng có trong báo cáo.`,
      fields: bad,
    });
  }
  return Object.fromEntries(
    rows.map((r) => [r.key, (input[r.key] as number | undefined) ?? r.need]),
  );
}
