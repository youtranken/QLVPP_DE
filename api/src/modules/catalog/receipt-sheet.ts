import { ConflictException } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { ymToDate } from '../../common/period';
import type { Tx } from '../../database/database.module';
import { latestSent, type SentSnapshot } from '../reports/sent-snapshot';

// FOR SHARE dòng kỳ: tạo bản chốt ghi dòng này trước, nên không bản nào chen vào giữa lúc đọc và lúc nhập
export async function sheetWithin(
  tx: Tx,
  ym: string,
): Promise<SentSnapshot | null> {
  await tx.execute(
    sql`SELECT 1 FROM periods WHERE ym = ${ymToDate(ym)}::date FOR SHARE`,
  );
  return latestSent(tx, ym);
}

// Nhập theo bản in client đang xem; bản mới hơn (Làm bản mới) → tải lại. Không gửi id (về bù) thì không kiểm.
export function assertLatestSheet(
  sent: SentSnapshot | null,
  snapshotId: string | null | undefined,
): void {
  if (snapshotId === undefined) return;
  const latest = sent?.id ?? null;
  if (latest !== snapshotId) {
    throw new ConflictException({
      code: 'STALE_UPDATE',
      message: 'Bản in trình ký vừa đổi — tải lại Hàng về rồi nhập lại.',
      snapshot_id: latest,
    });
  }
}
