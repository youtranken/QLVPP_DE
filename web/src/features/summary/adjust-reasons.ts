import type { AdjustReason } from './summary.api';

// G2: một lý do chung bằng chip; "Người đã nghỉ" chỉ hiện khi chủ phiếu đã nghỉ (server không gửi chuông cho họ)
export function reasonChoices({ ownerLeft }: { ownerLeft: boolean }): AdjustReason[] {
  const base: AdjustReason[] = ['adm_out_of_stock', 'over_quota', 'cannot_buy', 'other'];
  return ownerLeft ? ['user_left', ...base] : base;
}
