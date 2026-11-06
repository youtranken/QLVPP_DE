import type { ReactNode } from 'react';

export type ChipTone = 'ok' | 'warn' | 'muted' | 'open' | 'danger';

// Nhãn trạng thái dạng viên thuốc của Lịch sử (v2): màu luôn đi kèm chữ
export function Chip({ tone, children }: { tone: ChipTone; children: ReactNode }) {
  return <span className={`hs-chip hs-chip--${tone}`}>{children}</span>;
}
