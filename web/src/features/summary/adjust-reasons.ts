import type { LineView } from '@/features/request/request.api';
import type { AdjustReason } from './summary.api';

// Nháp lý do của một dòng: giữ cả khi dòng về lại số cũ (khối ẩn) tới khi Lưu/Hủy
export interface LineReason {
  code?: AdjustReason;
  note: string;
}

type Translate = (key: string, opts?: Record<string, unknown>) => string;

// Tối đa/tháng bị hạ sau khi nhân viên lưu: dòng giữ số cũ lớn hơn tối đa hiện tại
export const isOverMax = (l: LineView) => l.max_qty !== null && l.qty > l.max_qty;

// "Người đã nghỉ" chỉ hiện khi cần: server không gửi chuông cho người đã nghỉ nên mã này còn nghĩa
export function reasonChoices({ ownerLeft }: { ownerLeft: boolean }): AdjustReason[] {
  const base: AdjustReason[] = ['adm_out_of_stock', 'other'];
  return ownerLeft ? ['user_left', ...base] : base;
}

export function defaultReason(line: LineView, preset: AdjustReason | undefined, t?: Translate): LineReason {
  if (preset) return { code: preset, note: '' };
  if (isOverMax(line) && t) return { code: 'other', note: t('summary.adjust.overMaxNote', { max: line.max_qty }) };
  return { code: undefined, note: '' };
}
