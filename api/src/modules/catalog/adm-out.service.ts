import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { ymToDate } from '../../common/period';
import { DRIZZLE_DB } from '../../database/database.module';
import type { Database, Executor, Tx } from '../../database/database.module';
import { AuditWriterService } from '../audit/audit-writer.service';
import { PeriodsService } from '../periods/periods.service';
import { openLineCount } from '../requests/line-delivery.store';
import { itemNotFound } from './catalog.service';
import { lockCustomKey } from './custom-key-lock';
import type { LineKey } from './line-key';

type Kind = 'out' | 'owed_closed';

interface MarkAudit {
  ym: string;
  key: string;
  kind: Kind;
  on: boolean;
  actor: string;
  now: Date;
}

export const admOutNothingOpen = () =>
  new ConflictException({
    code: 'ADM_OUT_NOTHING_OPEN',
    message: 'Không còn ai chờ món này trong kỳ.',
  });

export const admOutFinal = (
  message = 'Các dòng của món này đã giao/hủy xong — không bỏ đánh dấu được nữa.',
) => new ConflictException({ code: 'ADM_OUT_FINAL', message });

// Kỳ sau đã khóa thì việc tự hủy lúc khóa sổ đã chạy: đổi dấu lúc này không còn ai xử lý (R-D11.12)
const settledFinal = () =>
  admOutFinal(
    'Kỳ sau đã khóa sổ — "NCC hết hàng" của kỳ này đã xử lý xong, không đổi được nữa.',
  );

export const itemAdmOut = (key: string) =>
  new ConflictException({
    code: 'ITEM_ADM_OUT',
    message: 'Món này đang đánh "NCC hết hàng" — bỏ đánh dấu trước khi nhập.',
    item_id: key,
  });

const FLAG: Record<Kind, string> = {
  out: 'adm_out',
  owed_closed: 'owed_closed',
};

export async function markedKeys(
  ex: Executor,
  ym: string,
  kind: Kind = 'out',
): Promise<Set<string>> {
  const { rows } = await ex.execute<{ line_key: string }>(sql`
    SELECT line_key FROM period_adm_out
    WHERE period_ym = ${ymToDate(ym)}::date AND kind = ${kind}`);
  return new Set(rows.map((r) => r.line_key));
}

// Đánh dấu theo kỳ (không đổi items.active); FOR UPDATE trên dòng đánh dấu để tự hủy lúc khóa sổ và bỏ đánh dấu không chéo nhau
@Injectable()
export class AdmOutService {
  constructor(
    @Inject(DRIZZLE_DB) private readonly db: Database,
    private readonly periods: PeriodsService,
    private readonly audit: AuditWriterService,
  ) {}

  async mark(ym: string, lk: LineKey, actor: string, now: Date) {
    await this.assertMarkable(ym, now);
    await this.db.transaction(async (tx) => {
      if (await this.locked(tx, ym, lk.key, 'out')) return;
      await this.assertItem(tx, ym, lk);
      if ((await openLineCount(tx, ym, lk.key)) === 0) {
        throw admOutNothingOpen();
      }
      await this.insert(tx, ym, lk.key, 'out', actor, now);
    });
    return { line_key: lk.key, item_id: lk.item_id, adm_out: true };
  }

  async unmark(ym: string, lk: LineKey, actor: string, now: Date) {
    await this.assertMarkable(ym, now);
    await this.db.transaction(async (tx) => {
      if (!(await this.locked(tx, ym, lk.key, 'out'))) return;
      if ((await openLineCount(tx, ym, lk.key)) === 0) throw admOutFinal();
      await this.remove(tx, ym, lk.key, 'out', actor, now);
    });
  }

  async closeOwed(ym: string, lk: LineKey, actor: string, now: Date) {
    await this.periods.assertLocked(ym, now);
    await this.db.transaction(async (tx) => {
      if (await this.locked(tx, ym, lk.key, 'owed_closed')) return;
      await this.assertItem(tx, ym, lk);
      await this.insert(tx, ym, lk.key, 'owed_closed', actor, now);
    });
    return { line_key: lk.key, item_id: lk.item_id, owed_closed: true };
  }

  async reopenOwed(ym: string, lk: LineKey, actor: string, now: Date) {
    await this.periods.assertLocked(ym, now);
    await this.db.transaction(async (tx) => {
      if (!(await this.locked(tx, ym, lk.key, 'owed_closed'))) return;
      await this.remove(tx, ym, lk.key, 'owed_closed', actor, now);
    });
  }

  private async assertMarkable(ym: string, now: Date): Promise<void> {
    await this.periods.assertLocked(ym, now);
    const latest = await this.periods.latestLocked(now);
    if (latest && ym < latest.ym) throw settledFinal();
  }

  // Khóa cùng thứ tự với nhập hàng về (món FOR NO KEY UPDATE / khóa tư vấn khóa ngoài DM) → nhập không lọt qua lúc dấu đang ghi
  private async assertItem(tx: Tx, ym: string, lk: LineKey): Promise<void> {
    if (!lk.item_id) return lockCustomKey(tx, ym, lk.key);
    const { rows } = await tx.execute(
      sql`SELECT 1 FROM items WHERE id = ${lk.item_id} FOR SHARE`,
    );
    if (rows.length === 0) throw itemNotFound();
  }

  private async locked(
    tx: Tx,
    ym: string,
    key: string,
    kind: Kind,
  ): Promise<boolean> {
    const { rows } = await tx.execute(sql`
      SELECT 1 FROM period_adm_out
      WHERE period_ym = ${ymToDate(ym)}::date AND line_key = ${key} AND kind = ${kind}
      FOR UPDATE`);
    return rows.length > 0;
  }

  // Kỳ khóa cũ không có dòng periods thì không có gì để đánh dấu
  private async insert(
    tx: Tx,
    ym: string,
    key: string,
    kind: Kind,
    actor: string,
    now: Date,
  ): Promise<void> {
    const inserted = await tx.execute(sql`
      INSERT INTO period_adm_out (period_ym, line_key, kind, marked_by, marked_at)
      SELECT ym, ${key}, ${kind}, ${actor}, ${now.toISOString()}::timestamptz
      FROM periods WHERE ym = ${ymToDate(ym)}::date
      ON CONFLICT DO NOTHING`);
    if ((inserted.rowCount ?? 0) === 0) {
      if (await this.locked(tx, ym, key, kind)) return;
      throw admOutNothingOpen();
    }
    await this.writeAudit(tx, { ym, key, kind, on: true, actor, now });
  }

  private async remove(
    tx: Tx,
    ym: string,
    key: string,
    kind: Kind,
    actor: string,
    now: Date,
  ): Promise<void> {
    await tx.execute(sql`
      DELETE FROM period_adm_out
      WHERE period_ym = ${ymToDate(ym)}::date AND line_key = ${key} AND kind = ${kind}`);
    await this.writeAudit(tx, { ym, key, kind, on: false, actor, now });
  }

  private async writeAudit(tx: Tx, a: MarkAudit): Promise<void> {
    const { ym, key, kind, on, actor } = a;
    await this.audit.appendWithin(tx, {
      actor,
      action:
        kind === 'out'
          ? on
            ? 'arrival.adm_out_marked'
            : 'arrival.adm_out_unmarked'
          : on
            ? 'arrival.adm_owed_closed'
            : 'arrival.adm_owed_reopened',
      objectType: 'period',
      objectId: ym,
      detail: {
        line_key: key,
        before: { [FLAG[kind]]: !on },
        after: { [FLAG[kind]]: on },
      },
      at: a.now,
    });
  }
}
