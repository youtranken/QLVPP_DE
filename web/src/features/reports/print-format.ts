import { useQuery } from '@tanstack/react-query';
import { useCallback } from 'react';
import { formatVnStamp } from '@/lib/format-time';
import { unitLabel, unitsQuery } from '@/features/units/units.api';
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

export const orderOf = (snap: SnapshotData, row: { key: string; need: number }) => snap.order_qty[row.key] ?? row.need;

export const isDefaultOrder = (snap: SnapshotData) => [...snap.byItem, ...snap.custom].every((r) => orderOf(snap, r) === r.need);

// Số thứ tự tính từ bản cũ nhất; danh sách API trả mới trước
export function snapshotOrdinal(list: SnapshotRow[] | undefined, id: string): number | null {
  const index = list?.findIndex((s) => s.id === id) ?? -1;
  return index < 0 ? null : list!.length - index;
}

// Bản chốt trước 0112 chỉ có signers: in 3 ô với chức danh cũ
export function signBoxesOf(snap: SnapshotData, oldTitle: (role: string) => string): SignBox[] {
  if (snap.signature_boxes) return snap.signature_boxes;
  return OLD_SIGNERS.map((role) => ({ title: oldTitle(role), title_en: '', name: snap.signers?.[role] ?? '' }));
}

// Bản chốt mới in tên ĐVT đã chụp; bản chốt cũ chưa có thì dùng tên hiện tại trong bảng ĐVT
export function useFrozenUnitName() {
  const { data } = useQuery(unitsQuery);
  return useCallback(
    (row: { unit: string } & FrozenUnitName, lang: string) => {
      const unit = row.unit_name !== undefined ? { name: row.unit_name, name_en: row.unit_name_en ?? null } : data?.find((u) => u.code === row.unit);
      return unit ? unitLabel(unit, lang) : row.unit;
    },
    [data],
  );
}
