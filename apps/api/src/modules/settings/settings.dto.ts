import { REG_WINDOW_MAX_DAY, REG_WINDOW_MIN_DAY } from '@vpp/shared';
import { z } from 'zod';

const day = z.coerce
  .number()
  .int('Ngày phải là số nguyên')
  .min(REG_WINDOW_MIN_DAY, `Ngày nhỏ nhất là ${REG_WINDOW_MIN_DAY}`)
  .max(REG_WINDOW_MAX_DAY, `Ngày lớn nhất là ${REG_WINDOW_MAX_DAY}`);

/**
 * Đổi khung ngày đăng ký. Quan hệ `startDay <= endDay` được kiểm ở service bằng
 * `checkWindowDays` dùng chung với frontend, nên ở đây chỉ kiểm từng ngày.
 */
export const UpdateWindowSchema = z.object({
  startDay: day,
  endDay: day,
});

export type UpdateWindowDto = z.infer<typeof UpdateWindowSchema>;
