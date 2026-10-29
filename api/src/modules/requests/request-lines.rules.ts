export type ReviewStatus =
  'n/a' | 'pending' | 'accepted' | 'converted' | 'rejected';
export type WriteMode = 'member' | 'admin';

export interface LineState {
  added_by_admin: boolean;
  review_status: ReviewStatus;
  delivered_qty: number;
}

export interface LineSnap {
  item_id: string | null;
  custom_name: string | null;
  custom_unit: string | null;
  custom_note: string | null;
  image_file_id: string | null;
  qty: number;
}

export interface LineRow extends LineSnap, LineState {
  id: string;
  cancelled_qty: number;
  cancel_note: string | null;
  review_note: string | null;
}

const SNAP_KEYS: (keyof LineSnap)[] = [
  'item_id',
  'custom_name',
  'custom_unit',
  'custom_note',
  'image_file_id',
  'qty',
];

// Hành chính đã thêm, đã duyệt hoặc đã giao một phần: member chỉ xem
export function isMemberReadonly(line: LineState): boolean {
  return (
    line.added_by_admin ||
    ['accepted', 'converted', 'rejected'].includes(line.review_status) ||
    line.delivered_qty > 0
  );
}

export function isDeletable(line: LineState, mode: WriteMode): boolean {
  return (
    line.delivered_qty === 0 &&
    ['n/a', 'pending'].includes(line.review_status) &&
    (mode === 'admin' || !line.added_by_admin)
  );
}

export function snapOf(line: LineSnap): LineSnap {
  return Object.fromEntries(SNAP_KEYS.map((k) => [k, line[k]])) as never;
}

export function sameSnap(a: LineSnap, b: LineSnap): boolean {
  return SNAP_KEYS.every((k) => a[k] === b[k]);
}
