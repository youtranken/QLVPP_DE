import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE_DB } from '../../database/database.module';
import type { Database, Executor } from '../../database/database.module';
import { PeriodsService } from '../periods/periods.service';
import { admOwedRows } from '../reports/order-default';
import { itemDemand } from '../reports/report-queries';
import { wantOf } from '../reports/report-need';
import { latestSent } from '../reports/sent-snapshot';
import type { SentSnapshot } from '../reports/sent-snapshot';
import {
  customFacts,
  itemFacts,
  itemsByIds,
  receiptBatches,
} from './arrivals-plan.queries';
import type { BatchRow, ItemFactsRow } from './arrivals-plan.queries';

export interface ArrivalRow extends Omit<ItemFactsRow, 'open_lines'> {
  key: string;
  ordered: number;
  remaining: number;
  adm_out_final: boolean;
}

export interface ArrivalCustomRow {
  key: string;
  name: string;
  unit: string;
  ordered: number;
  received: number;
  remaining: number;
  adm_out: boolean;
  adm_out_final: boolean;
}

export interface MakeupRow {
  key: string;
  item_id: string | null;
  name: string;
  name_en: string | null;
  unit: string;
  stock_qty: number | null;
  ordered: number;
  received: number;
  adm_owed: number;
}

export interface ArrivalsPlan {
  snapshot: { id: string; kind: string; created_at: string } | null;
  batches: BatchRow[];
  rows: ArrivalRow[];
  custom: ArrivalCustomRow[];
  makeup: { ym: string; rows: MakeupRow[] }[];
}

const remainingOf = (ordered: number, received: number) =>
  Math.max(0, ordered - received);

// Đọc-only: số Đề nghị theo bản có hàng mới nhất; chưa có bản → số gộp (không trừ tủ)
@Injectable()
export class ArrivalsPlanService {
  constructor(
    @Inject(DRIZZLE_DB) private readonly db: Database,
    private readonly periods: PeriodsService,
  ) {}

  async plan(ym: string, now: Date): Promise<ArrivalsPlan> {
    await this.periods.assertLocked(ym, now);
    const sent = await latestSent(this.db, ym);
    const ordered = sent
      ? orderedFromSnapshot(sent)
      : await this.orderedFromDemand(ym);
    const facts = await itemFacts(
      this.db,
      ym,
      [...ordered.keys()],
      sent?.created_at ?? null,
    );
    return {
      snapshot: sent
        ? { id: sent.id, kind: sent.kind, created_at: sent.created_at }
        : null,
      batches: await receiptBatches(this.db, ym),
      rows: facts
        .map((f) => toRow(f, ordered.get(f.item_id) ?? 0))
        .filter((r) => r.usable || r.ordered > 0),
      custom: sent ? await this.customRows(ym, sent) : [],
      makeup: await this.makeup(ym),
    };
  }

  private async orderedFromDemand(ym: string): Promise<Map<string, number>> {
    const demand = await itemDemand(this.db, ym);
    return new Map(
      demand
        .filter((d) => d.usable && wantOf(d) > 0)
        .map((d) => [d.item_id, wantOf(d)]),
    );
  }

  private async customRows(
    ym: string,
    sent: SentSnapshot,
  ): Promise<ArrivalCustomRow[]> {
    const facts = await customFacts(this.db, ym);
    return sent.data.custom.flatMap((c) => {
      const ordered = sent.data.order_qty[c.key] ?? wantOf(c);
      if (ordered <= 0) return [];
      const f = facts.get(c.key);
      const received = f?.received ?? 0;
      const admOut = f?.adm_out ?? false;
      return [
        {
          key: c.key,
          name: c.name,
          unit: c.unit,
          ordered,
          received,
          remaining: remainingOf(ordered, received),
          adm_out: admOut,
          adm_out_final: admOut && (f?.open_lines ?? 0) === 0,
        },
      ];
    });
  }

  private async makeup(ym: string): Promise<ArrivalsPlan['makeup']> {
    const owed = await admOwedRows(this.db, ym);
    if (owed.length === 0) return [];
    const items = await itemsByIds(
      this.db,
      owed.filter((o) => !o.key.startsWith('custom:')).map((o) => o.key),
    );
    const byPeriod = new Map<string, MakeupRow[]>();
    for (const o of owed) {
      const row = await this.makeupRow(this.db, o, items);
      if (!row) continue;
      byPeriod.set(o.period_ym, [...(byPeriod.get(o.period_ym) ?? []), row]);
    }
    const rank = new Map([...items.keys()].map((id, i) => [id, i]));
    const rankOf = (r: MakeupRow) =>
      r.item_id === null ? rank.size : rank.get(r.item_id)!;
    return [...byPeriod].map(([p, rows]) => ({
      ym: p,
      rows: rows.sort((a, b) => rankOf(a) - rankOf(b)),
    }));
  }

  private async makeupRow(
    ex: Executor,
    o: Awaited<ReturnType<typeof admOwedRows>>[number],
    items: Awaited<ReturnType<typeof itemsByIds>>,
  ): Promise<MakeupRow | null> {
    const counts = {
      key: o.key,
      ordered: o.ordered,
      received: o.received,
      adm_owed: o.owed,
    };
    if (!o.key.startsWith('custom:')) {
      const item = items.get(o.key);
      return item ? { ...counts, item_id: o.key, ...item } : null;
    }
    const sent = await latestSent(ex, o.period_ym);
    const c = sent?.data.custom.find((r) => r.key === o.key);
    if (!c) return null;
    return {
      ...counts,
      item_id: null,
      name: c.name,
      name_en: null,
      unit: c.unit,
      stock_qty: null,
    };
  }
}

export function orderedFromSnapshot(sent: SentSnapshot): Map<string, number> {
  const ordered = new Map<string, number>();
  for (const r of sent.data.byItem) {
    const qty = sent.data.order_qty[r.key] ?? wantOf(r);
    if (qty > 0) ordered.set(r.item_id ?? r.key, qty);
  }
  return ordered;
}

function toRow(f: ItemFactsRow, ordered: number): ArrivalRow {
  const { open_lines, ...rest } = f;
  return {
    ...rest,
    key: f.item_id,
    ordered,
    remaining: remainingOf(ordered, f.received),
    adm_out_final: f.adm_out && open_lines === 0,
  };
}
