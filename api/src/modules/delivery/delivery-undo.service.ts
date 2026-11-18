import { Inject, Injectable } from '@nestjs/common';
import { ClockService } from '../../common/clock.service';
import { DRIZZLE_DB } from '../../database/database.module';
import type { Database, Tx } from '../../database/database.module';
import { AuditWriterService } from '../audit/audit-writer.service';
import { StockService } from '../catalog/stock.service';
import { eventIds } from '../notifications/notification-events';
import { NotificationsService } from '../notifications/notifications.service';
import { LineDeliveryStore } from '../requests/line-delivery.store';
import type { LockedLine } from '../requests/line-delivery.store';
import type { UndoResult } from '../undo/undo.dto';
import { UndoLedgerService } from '../undo/undo-ledger.service';
import { staleDelivery } from './delivery-errors';
import * as repo from './delivery.repo';
import type { UndoDelivery } from './delivery.repo';

interface RequestState {
  lines: LockedLine[];
  deliveriesBefore: number;
  wasComplete: boolean;
}

@Injectable()
export class DeliveryUndoService {
  constructor(
    @Inject(DRIZZLE_DB) private readonly db: Database,
    private readonly clock: ClockService,
    private readonly ledger: UndoLedgerService,
    private readonly lines: LineDeliveryStore,
    private readonly stock: StockService,
    private readonly audit: AuditWriterService,
    private readonly notifications: NotificationsService,
  ) {}

  async undoDeliveries(ids: string[], actor: string): Promise<UndoResult> {
    const now = this.clock.now();
    return this.db.transaction(async (tx) => {
      await this.ledger.claimWithin(tx, { ids, kind: 'delivery', actor, now });
      const ds = await repo.deliveriesOfUndo(tx, ids);
      const byRequest = groupBy(ds, (d) => d.request_id);
      const states = new Map<string, RequestState>();
      for (const [requestId, mine] of byRequest) {
        const lineIds = [...new Set(mine.map((d) => d.line_id))].sort();
        states.set(requestId, {
          lines: await this.lines.lockRequestLines(tx, requestId, lineIds),
          deliveriesBefore: await repo.countRequestDeliveries(tx, requestId),
          wasComplete: await this.lines.isComplete(tx, requestId),
        });
      }
      const lineOf = new Map(
        [...states.values()].flatMap((s) => s.lines).map((l) => [l.id, l]),
      );
      const itemIds = [...lineOf.values()].flatMap((l) => l.item_id ?? []);
      await this.stock.lockItemsWithin(tx, [...new Set(itemIds)]);
      await repo.deleteDeliveries(
        tx,
        ds.map((d) => d.id),
      );
      for (const [lineId, mine] of groupBy(ds, (d) => d.line_id)) {
        await this.undoLine(tx, lineOf.get(lineId)!, mine, { actor, now, ids });
      }
      for (const [requestId, s] of states) {
        await this.afterRequest(tx, requestId, s, now);
      }
      return { undone: ds.length };
    });
  }

  private async undoLine(
    tx: Tx,
    line: LockedLine,
    mine: UndoDelivery[],
    by: { actor: string; now: Date; ids: string[] },
  ): Promise<void> {
    const qty = mine.reduce((n, d) => n + d.qty, 0);
    const lastAt = await repo.lastDeliveredAt(tx, line.id);
    if (!(await this.lines.removeDelivered(tx, line.id, qty, lastAt, by.now))) {
      throw staleDelivery(line.delivered_qty);
    }
    const returned: string[] = [];
    for (const d of mine) {
      if (!line.item_id || !d.movement_id) continue;
      const back = await this.stock.returnForUndoWithin(tx, {
        itemId: line.item_id,
        qty: d.qty,
        lineId: line.id,
        actor: by.actor,
        now: by.now,
        refMovementId: d.movement_id,
      });
      returned.push(back.movement_id);
    }
    await this.audit.appendWithin(tx, {
      actor: by.actor,
      action: 'line.delivery_undone',
      objectType: 'request_line',
      objectId: line.id,
      detail: {
        request_id: line.request_id,
        before: { delivered_qty: line.delivered_qty },
        after: { delivered_qty: line.delivered_qty - qty },
        qty,
        undo_ids: by.ids,
        return_movement_ids: returned,
      },
      at: by.now,
    });
  }

  private async afterRequest(
    tx: Tx,
    requestId: string,
    s: RequestState,
    now: Date,
  ): Promise<void> {
    await this.lines.touchRequest(tx, requestId, now);
    if (!s.wasComplete || (await this.lines.isComplete(tx, requestId))) return;
    const owner = s.lines[0].user_sub;
    const eventId = eventIds.requestDelivered(requestId, s.deliveriesBefore);
    await this.notifications.removeByEvent(owner, eventId, tx);
  }
}

function groupBy<T>(xs: T[], key: (x: T) => string): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const x of xs) out.set(key(x), [...(out.get(key(x)) ?? []), x]);
  return out;
}
