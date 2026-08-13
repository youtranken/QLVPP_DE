import { formatPeriod } from '@vpp/shared';

/** Nhãn hiển thị kỳ (tiếng Việt), tách khỏi component (business logic ở lib). */
export function periodLabel(period: string): string {
  return formatPeriod(period);
}
