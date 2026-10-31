import type { BookingImportResult } from './booking-apply';
import type { BookingSkip } from './booking-import';

const REASONS: Record<BookingSkip['reason'], string> = {
  empty_name: 'tên trống',
  empty_unit: 'ĐVT trống',
  exists_code: 'đã có món cùng mã',
  exists_name: 'đã có món cùng tên',
  unit_inactive: 'ĐVT đã ngừng — mở lại ĐVT hoặc sửa file',
};

const section = (title: string, lines: string[]) => [
  `${title}: ${lines.length}`,
  ...lines.map((l) => `  - ${l}`),
];

export function formatBookingReport(r: BookingImportResult): string {
  return [
    r.applied
      ? 'ĐÃ GHI — một transaction, audit catalog.imported.'
      : 'CHẠY THỬ — chưa ghi gì (thêm --apply để ghi).',
    `Món tạo: ${r.created.length}`,
    ...section(
      'Bỏ qua',
      r.skipped.map(
        (s) =>
          `hàng ${s.row}${s.code ? ` (${s.code})` : ''}${s.name ? ` ${s.name}` : ''}: ${REASONS[s.reason]}`,
      ),
    ),
    ...section(
      'ĐVT tạo mới',
      r.unitsCreated.map((u) => `${u.name} (${u.code})`),
    ),
    ...section(
      'Cần đặt mã',
      r.needCode.map(
        (n) =>
          `hàng ${n.row}: ${n.name} (${n.fileCode ? `mã ${n.fileCode} trùng hàng trên` : 'không có mã'})`,
      ),
    ),
  ].join('\n');
}
