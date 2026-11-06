import { ConflictException } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { ymToDate } from '../../common/period';
import type { Tx } from '../../database/database.module';
import { latestSent } from '../reports/sent-snapshot';

// Nhập theo bản in client đang xem; bản mới hơn (Làm bản mới) → tải lại. Không gửi id (về bù) thì không kiểm.
// FOR SHARE dòng kỳ: tạo bản chốt ghi dòng này trước, nên bản không chen vào giữa lúc kiểm và lúc nhập
export async function assertLatestSheet(
  tx: Tx,
  ym: string,
  snapshotId: string | null | undefined,
): Promise<void> {
  if (snapshotId === undefined) return;
  await tx.execute(
    sql`SELECT 1 FROM periods WHERE ym = ${ymToDate(ym)}::date FOR SHARE`,
  );
  const latest = (await latestSent(tx, ym))?.id ?? null;
  if (latest !== snapshotId) {
    throw new ConflictException({
      code: 'STALE_UPDATE',
      message: 'Bản in trình ký vừa đổi — tải lại Hàng về rồi nhập lại.',
      snapshot_id: latest,
    });
  }
}
