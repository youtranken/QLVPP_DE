import { useCallback } from 'react';
import { formatVnStamp } from '@/lib/format-time';
import { wantOf } from '@/lib/report-qty';
import { unitLabel, useUnitNames } from '@/features/units/units.api';
import type { FrozenUnitName, SnapshotData } from './reports.api';

export interface SignBox {
  title: string;
  title_en: string;
  name: string;
}

// Mẫu D&E chỉ có 2 chỗ ký: Chủ quản đơn vị (trái), Người yêu cầu (phải); bản cũ ánh xạ như migration 0112
const OLD_SIGNERS = ['head', 'preparer'] as const;
export const MAX_SIGN_BOXES = 2;

// "Date : MM/YYYY" của kỳ trên tờ in: '2026-11' → '11/2026'
export const periodLabel = (ym: string) => `${ym.slice(5, 7)}/${ym.slice(0, 4)}`;

export function vnStampParts(iso: string) {
  const [time, date] = formatVnStamp(iso, true).split(' ');
  return { time, date, dayMonth: date.slice(0, 5) };
}

// Bản chốt cũ thiếu khóa → số gộp, như server
export const orderOf = (snap: SnapshotData, row: { key: string; requested: number; backlog_prev: number }) => snap.order_qty[row.key] ?? wantOf(row);

// Bản chốt từ v2-D (có order_basis) in cả hàng Đề nghị 0 để khớp bảng Gửi ADM; bản cũ giữ đúng tờ đã gửi (bỏ hàng 0), như server
export const keepsZeroRows = (snap: Pick<SnapshotData, 'order_basis'>) => snap.order_basis !== undefined;

// Bản có hàng ⇔ có Đề nghị > 0 (cùng vị từ với server)
export const hasItems = (snap: Pick<SnapshotData, 'order_qty'>) => Object.values(snap.order_qty).some((n) => n > 0);

// Tờ in chỉ 2 ô ký: cấu hình nhiều hơn (vd thêm "Duyệt") thì lấy 2 ô đầu; bản trước 0112 chỉ có signers → head/preparer, bỏ approver
export function signBoxesOf(snap: SnapshotData, oldTitle: (role: string) => Omit<SignBox, 'name'>): SignBox[] {
  if (snap.signature_boxes) return snap.signature_boxes.slice(0, MAX_SIGN_BOXES);
  return OLD_SIGNERS.map((role) => ({ ...oldTitle(role), name: snap.signers?.[role] ?? '' }));
}

// Bản chốt mới in tên ĐVT đã chụp; bản chốt cũ chưa có thì dùng tên hiện tại trong bảng ĐVT
export function useFrozenUnitName() {
  const unitNames = useUnitNames();
  return useCallback(
    (row: { unit: string } & FrozenUnitName, lang: string) =>
      row.unit_name !== undefined ? unitLabel({ name: row.unit_name, name_en: row.unit_name_en ?? null }, lang) : unitNames(row.unit, lang),
    [unitNames],
  );
}
