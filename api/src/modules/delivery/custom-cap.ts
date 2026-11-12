import type { Tx } from '../../database/database.module';
import {
  customDelivered,
  customReceived,
  lineKeyOf,
  lockCustomKey,
} from '../catalog/custom-key-lock';
import type { LockedLine } from '../requests/line-delivery.store';
import { customNotReceived } from './delivery-errors';

// Món ngoài DM chỉ giao sau khi hàng về (chủ app vòng 7, kể cả khóa duyệt sau khi gửi NCC — chưa có trong bản thì chưa nhận được):
// giao không vượt Σ đã về − Σ đã giao của khóa trong kỳ dòng (R-D11.21); thứ tự đăng ký chỉ là gợi ý ở danh sách
export async function assertCustomReceived(
  tx: Tx,
  line: LockedLine,
  qty: number,
): Promise<void> {
  if (line.item_id) return;
  const key = await lineKeyOf(tx, line.id);
  await lockCustomKey(tx, line.period_ym, key);
  const available = Math.max(
    0,
    (await customReceived(tx, line.period_ym, key)) -
      (await customDelivered(tx, line.period_ym, key)),
  );
  if (qty > available) throw customNotReceived(available);
}
