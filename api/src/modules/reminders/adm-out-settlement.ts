import { Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { ymToDate } from '../../common/period';
import type { Tx } from '../../database/database.module';
import { AuditWriterService } from '../audit/audit-writer.service';
import {
  ADM_OUT_NOTE,
  ADM_OUT_REASON,
  admOutCancelDetail,
} from '../delivery/adm-out-cancel';
import { LineDeliveryStore } from '../requests/line-delivery.store';
import { LineNotifier } from '../requests/line-notifier';

export interface SettleResult {
  lines: number;
  units: number;
}

const SYSTEM = 'system';

// Kỳ sau khóa sổ: phần chưa giao của món đánh "ADM hết hàng" bị hủy, không thành nợ; chạy lại không còn gì để hủy
@Injectable()
export class AdmOutSettlement {
  constructor(
    private readonly lines: LineDeliveryStore,
    private readonly audit: AuditWriterService,
    private readonly notifier: LineNotifier,
  ) {}

  async settleAdmOut(
    tx: Tx,
    lockedYm: string,
    now: Date,
  ): Promise<SettleResult> {
    const { rows } = await tx.execute<{ line_key: string }>(sql`
      SELECT line_key FROM period_adm_out
      WHERE period_ym = ${ymToDate(lockedYm)}::date AND kind = 'out'
      ORDER BY line_key FOR UPDATE`);
    const total: SettleResult = { lines: 0, units: 0 };
    const owners = new Set<string>();
    for (const { line_key } of rows) {
      const done = await this.settleKey(tx, lockedYm, line_key, now, owners);
      total.lines += done.lines;
      total.units += done.units;
    }
    for (const userSub of owners) {
      await this.notifier.linesAdjusted(tx, {
        userSub,
        ym: lockedYm,
        reasons: [ADM_OUT_REASON],
        now,
      });
    }
    return total;
  }

  private async settleKey(
    tx: Tx,
    ym: string,
    key: string,
    now: Date,
    owners: Set<string>,
  ): Promise<SettleResult> {
    const done: SettleResult = { lines: 0, units: 0 };
    for (const id of await this.lines.openLineIds(tx, ym, key)) {
      const line = await this.lines.lockLine(tx, id);
      if (!line) continue;
      const result = await this.lines.cancelRemaining(
        tx,
        id,
        ADM_OUT_NOTE,
        now,
      );
      if (result.cancelled_now === 0) continue;
      await this.audit.appendWithin(tx, {
        actor: SYSTEM,
        action: 'line.cancel_remaining',
        objectType: 'request_line',
        objectId: line.id,
        detail: admOutCancelDetail(line, result, now),
        at: now,
      });
      await this.lines.touchRequest(tx, line.request_id, now);
      owners.add(line.user_sub);
      done.lines += 1;
      done.units += result.cancelled_now;
    }
    if (done.lines > 0) {
      await this.audit.appendWithin(tx, {
        actor: SYSTEM,
        action: 'arrival.adm_out_settled',
        objectType: 'period',
        objectId: ym,
        detail: { period_ym: ym, line_key: key, ...done },
        at: now,
      });
    }
    return done;
  }
}
