import { REQUEST_STATUSES } from '@vpp/shared';
import { z } from 'zod';

/** Kỳ đăng ký dạng 'YYYY-MM'. */
export const PeriodSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Kỳ phải có dạng 'YYYY-MM'");

/**
 * Một dòng đơn.
 * - `itemId` có ⇒ tên và đơn vị LẤY TỪ DANH MỤC (không tin client gửi lên).
 * - `itemId` null ⇒ dòng mục "Khác": client phải tự nhập tên + đơn vị.
 * Số lượng chỉ kiểm dạng ở đây; giới hạn theo `max_qty` do `checkRequestLines` lo.
 */
export const RequestLineSchema = z.object({
  itemId: z.string().uuid().nullish().default(null),
  name: z.string().trim().max(200).optional(),
  unit: z.string().trim().max(30).optional(),
  quantity: z.number().int(),
  /** Đường dẫn ảnh trả về từ POST /api/uploads (chỉ dùng cho dòng "Khác"). */
  attachmentPath: z.string().trim().max(300).nullish(),
  note: z.string().trim().max(500).nullish(),
});

export const CreateRequestSchema = z.object({
  note: z.string().trim().max(500).nullish(),
  // Cố tình KHÔNG dùng .min(1): đơn rỗng phải trả mã nghiệp vụ EMPTY_REQUEST.
  lines: z.array(RequestLineSchema),
});

/** Điều chỉnh đặc biệt của admin: thay toàn bộ danh sách dòng (CORE-13). */
export const AdjustRequestSchema = z.object({
  note: z.string().trim().max(500).nullish(),
  lines: z.array(RequestLineSchema),
  /** Lý do điều chỉnh, ghi vào audit. */
  reason: z.string().trim().max(500).nullish(),
});

export const RejectRequestSchema = z.object({
  reason: z.string().trim().min(1, 'Phải nhập lý do từ chối').max(500),
});

export const DeliverLineSchema = z.object({
  delivered: z.boolean().optional().default(true),
  /** Bỏ trống ⇒ giao đủ số lượng đã đăng ký. */
  deliveredQty: z.number().int().min(0).optional(),
});

export const ListRequestsQuerySchema = z.object({
  period: PeriodSchema.optional(),
  departmentId: z.string().uuid().optional(),
  status: z.enum(REQUEST_STATUSES).optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export type CreateRequestDto = z.infer<typeof CreateRequestSchema>;
export type AdjustRequestDto = z.infer<typeof AdjustRequestSchema>;
export type RejectRequestDto = z.infer<typeof RejectRequestSchema>;
export type DeliverLineDto = z.infer<typeof DeliverLineSchema>;
export type ListRequestsQuery = z.infer<typeof ListRequestsQuerySchema>;
export type RequestLineDto = z.infer<typeof RequestLineSchema>;
