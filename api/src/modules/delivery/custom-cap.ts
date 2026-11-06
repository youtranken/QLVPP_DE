import type { Tx } from '../../database/database.module';
import {
  customDelivered,
  customReceived,
  lineKeyOf,
  lockCustomKey,
} from '../catalog/custom-key-lock';
import type { LockedLine } from '../requests/line-delivery.store';
import { latestSent } from '../reports/sent-snapshot';
import { customNotReceived } from './delivery-errors';

// Khóa ngoài DM có trong bản in của kỳ dòng: giao không vượt Σ đã về − Σ đã giao của khóa (R-D11.21); thứ tự đăng ký chỉ là gợi ý ở danh sách
export async function assertCustomReceived(
  tx: Tx,
  line: LockedLine,
  qty: number,
): Promise<void> {
  if (line.item_id) return;
  const key = await lineKeyOf(tx, line.id);
  const sent = await latestSent(tx, line.period_ym);
  if (!((sent?.data.order_qty[key] ?? 0) > 0)) return;
  await lockCustomKey(tx, line.period_ym, key);
  const available = Math.max(
    0,
    (await customReceived(tx, line.period_ym, key)) -
      (await customDelivered(tx, line.period_ym, key)),
  );
  if (qty > available) throw customNotReceived(available);
}
