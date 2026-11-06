import { useCallback } from 'react';
import { formatVnStamp } from '@/lib/format-time';
import { wantOf } from '@/lib/report-qty';
import { unitLabel, useUnitNames } from '@/features/units/units.api';
import type { FrozenUnitName, SnapshotData, SnapshotRow } from './reports.api';

export interface SignBox {
  title: string;
  title_en: string;
  name: string;
}

const OLD_SIGNERS = ['preparer', 'head', 'approver'] as const;

export function vnStampParts(iso: string) {
  const [time, date] = formatVnStamp(iso, true).split(' ');
  return { time, date, dayMonth: date.slice(0, 5) };
}

// Bản chốt cũ thiếu khóa → số gộp, như server
export const orderOf = (snap: SnapshotData, row: { key: string; requested: number; backlog_prev: number }) => snap.order_qty[row.key] ?? wantOf(row);

// Bản có hàng ⇔ có Đề nghị > 0 (cùng vị từ với server)
export const hasItems = (snap: Pick<SnapshotData, 'order_qty'>) => Object.values(snap.order_qty).some((n) => n > 0);

export function isDefaultOrder(snap: SnapshotData) {
  const rows = [...snap.byItem, ...snap.custom];
  return rows.length > 0 && rows.every((r) => orderOf(snap, r) === wantOf(r));
}

// Số thứ tự tính từ bản cũ nhất; danh sách API trả mới trước
export function snapshotOrdinal(list: SnapshotRow[] | undefined, id: string): number | null {
  const index = list?.findIndex((s) => s.id === id) ?? -1;
  return index < 0 ? null : list!.length - index;
}

// Bản chốt trước 0112 chỉ có signers: in 3 ô với chức danh cũ song ngữ, trùng Excel (OLD_SIGNER_TITLES)
export function signBoxesOf(snap: SnapshotData, oldTitle: (role: string) => Omit<SignBox, 'name'>): SignBox[] {
  if (snap.signature_boxes) return snap.signature_boxes;
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
