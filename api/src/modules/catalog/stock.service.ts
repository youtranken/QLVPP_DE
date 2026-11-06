import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DRIZZLE_DB } from '../../database/database.module';
import type { Database, Tx } from '../../database/database.module';
import { ClockService } from '../../common/clock.service';
import { AuditWriterService } from '../audit/audit-writer.service';
import { PeriodsService } from '../periods/periods.service';
import { UsersService } from '../users/users.service';
import { LOW_STOCK_SQL } from './catalog-sql';
import { itemNotFound } from './catalog.service';
import { countDelta, countNote, reasonRequired } from './stock-count';
import { heldSql } from './stock-held-sql';
import type { IssueDto, StockChangeDto, StockCountDto } from './stock.dto';

export interface StockResult {
  stock_qty: number;
  movement_id: string;
}

type MovementReason = AuditedMovement['reason'] | 'delivery';

interface MovementInput {
  itemId: string;
  delta: number;
  reason: MovementReason;
  note: string | null;
  recipientSub?: string | null;
  refLineId?: string | null;
  // Kỳ của hàng về (kỳ bản in hoặc kỳ được về bù); chỉ có ở purchase qua phiếu hàng về
  receiptYm?: string | null;
  // Giao hàng ghi theo ClockService như line_deliveries; biến động tay giữ now() của DB
  at?: Date;
}

// Chỉ biến động tay qua record() mới audit stock.<reason>; giao hàng audit ở line.delivered
interface AuditedMovement extends Omit<MovementInput, 'reason'> {
  reason: 'purchase' | 'adjust' | 'issue';
  tookHeld?: number;
  // Id dòng audit của một lần Lưu hàng về: Nhật ký gộp các món của lần đó
  batchId?: string;
}

export interface LowStockClaim extends Record<string, unknown> {
  id: string;
  name: string;
  name_en: string | null;
  stock_qty: number;
  last_purchase_id: string | null;
}

export interface DeliveryTake {
  itemId: string;
  qty: number;
  lineId: string;
  actor: string;
  now: Date;
}

@Injectable()
export class StockService {
  constructor(
    @Inject(DRIZZLE_DB) private readonly db: Database,
    private readonly audit: AuditWriterService,
    private readonly users: UsersService,
    private readonly periods: PeriodsService,
    private readonly clock: ClockService,
  ) {}

  async change(
    itemId: string,
    dto: StockChangeDto,
    actor: string,
  ): Promise<StockResult> {
    if (dto.reason === 'purchase' && dto.delta < 0) {
      throw new BadRequestException({
        code: 'VALIDATION',
        message: 'Nhập mua phải là số dương.',
      });
    }
    if (dto.reason === 'adjust' && !dto.note) throw reasonRequired();
    return this.db.transaction((tx) =>
      this.applyChangeWithin(
        tx,
        itemId,
        { delta: dto.delta, reason: dto.reason, note: dto.note ?? null },
        actor,
      ),
    );
  }

  async count(
    itemId: string,
    dto: StockCountDto,
    actor: string,
  ): Promise<StockResult> {
    const note = countNote(dto.note);
    return this.db.transaction(async (tx) => {
      const locked = (
        await tx.execute<{ stock_qty: number }>(sql`
          SELECT stock_qty FROM items WHERE id = ${itemId} FOR NO KEY UPDATE
        `)
      ).rows[0];
      if (!locked) throw itemNotFound();
      const delta = countDelta({
        counted: dto.counted_qty,
        expected: dto.expected_stock_qty,
        stock: locked.stock_qty,
      });
      return this.applyChangeWithin(
        tx,
        itemId,
        { delta, reason: 'adjust', note },
        actor,
      );
    });
  }

  // Nhập mua đặt lại mốc Sắp hết; điều chỉnh + chỉ đặt mốc khi món chưa có (tồn đầu kỳ), không đổi mốc đã có
  async applyChangeWithin(
    tx: Tx,
    itemId: string,
    change: {
      delta: number;
      reason: 'purchase' | 'adjust';
      note: string | null;
      receiptYm?: string | null;
      batchId?: string;
    },
    actor: string,
  ): Promise<StockResult> {
    const m = { ...change, itemId };
    const purchase = m.reason === 'purchase';
    const opening = m.reason === 'adjust' && m.delta > 0;
    const updated = await tx.execute<{ stock_qty: number }>(sql`
      UPDATE items SET stock_qty = stock_qty + ${m.delta},
        restock_level = CASE WHEN ${purchase}
                               OR (${opening} AND restock_level IS NULL)
                             THEN stock_qty + ${m.delta}
                             ELSE restock_level END,
        low_stock_notified_at = CASE WHEN ${purchase} THEN NULL
                                     ELSE low_stock_notified_at END,
        updated_at = now()
      WHERE id = ${m.itemId} AND stock_qty + ${m.delta} >= 0
      RETURNING stock_qty
    `);
    return this.record(tx, updated.rows[0], actor, m);
  }

  async issue(
    itemId: string,
    dto: IssueDto,
    actor: string,
  ): Promise<StockResult> {
    if (!dto.reason) throw reasonRequired();
    if (dto.recipient_sub) await this.assertActiveUser(dto.recipient_sub);
    return this.db.transaction(async (tx) => {
      const updated = await tx.execute<{ stock_qty: number }>(sql`
        UPDATE items SET stock_qty = stock_qty - ${dto.qty}, updated_at = now()
        WHERE id = ${itemId} AND stock_qty >= ${dto.qty}
        RETURNING stock_qty
      `);
      const after = updated.rows[0];
      return this.record(tx, after, actor, {
        itemId,
        delta: -dto.qty,
        reason: 'issue',
        note: dto.reason ?? null,
        recipientSub: dto.recipient_sub ?? null,
        tookHeld: after
          ? await this.tookHeldWithin(tx, itemId, after.stock_qty, dto.qty)
          : 0,
      });
    });
  }

  // Xuất lẻ được lấy phần đang giữ cho người chờ (không chặn); chỉ ghi lại đã lấy bao nhiêu
  private async tookHeldWithin(
    tx: Tx,
    itemId: string,
    stockAfter: number,
    qty: number,
  ): Promise<number> {
    const open = await this.periods.openPeriod(tx, this.clock.now());
    const held =
      (
        await tx.execute<{ held: number }>(sql`
          SELECT h.held FROM (${heldSql(open.ym)}) h WHERE h.item_id = ${itemId}
        `)
      ).rows[0]?.held ?? 0;
    const freeBefore = Math.max(0, stockAfter + qty - held);
    return Math.max(0, qty - freeBefore);
  }

  // Khóa theo id tăng chống deadlock chéo món; NO KEY để không chặn FK KEY SHARE khi lưu phiếu chèn dòng
  async lockItemsWithin(tx: Tx, itemIds: string[]): Promise<void> {
    if (itemIds.length === 0) return;
    await tx.execute(sql`
      SELECT id FROM items WHERE id = ANY(${sql.param(itemIds)}::uuid[])
      ORDER BY id FOR NO KEY UPDATE
    `);
  }

  // Không audit riêng: audit line.delivered của giao hàng đã ghi movement_id
  async takeForDeliveryWithin(
    tx: Tx,
    take: DeliveryTake,
  ): Promise<StockResult> {
    const updated = (
      await tx.execute<{ stock_qty: number }>(sql`
        UPDATE items SET stock_qty = stock_qty - ${take.qty},
          updated_at = ${take.now.toISOString()}::timestamptz
        WHERE id = ${take.itemId} AND stock_qty >= ${take.qty}
        RETURNING stock_qty
      `)
    ).rows[0];
    if (!updated) throw await this.rejection(tx, take.itemId);
    const movement = await this.insertMovement(tx, take.actor, {
      itemId: take.itemId,
      delta: -take.qty,
      reason: 'delivery',
      note: null,
      refLineId: take.lineId,
      at: take.now,
    });
    return { stock_qty: updated.stock_qty, movement_id: movement.id };
  }

  // Khóa theo id tăng như giao hàng (UPDATE trơn khóa theo thứ tự quét → deadlock với deliver-all); bên sau thấy đã báo
  async claimLowStockWithin(tx: Tx, now: Date): Promise<LowStockClaim[]> {
    const { rows } = await tx.execute<LowStockClaim>(sql`
      WITH due AS (
        SELECT id FROM items
        WHERE active AND ${sql.raw(LOW_STOCK_SQL)} AND low_stock_notified_at IS NULL
        ORDER BY id FOR NO KEY UPDATE
      )
      UPDATE items i SET low_stock_notified_at = ${now.toISOString()}::timestamptz
      FROM due WHERE i.id = due.id
      RETURNING i.id, i.name, i.name_en, i.stock_qty,
        (SELECT m.id FROM stock_movements m
         WHERE m.item_id = i.id AND m.reason = 'purchase'
         ORDER BY m.created_at DESC, m.id DESC LIMIT 1) AS last_purchase_id
    `);
    return rows;
  }

  private async insertMovement(
    tx: Tx,
    actor: string,
    m: MovementInput,
  ): Promise<{ id: string }> {
    const { rows } = await tx.execute<{ id: string }>(sql`
      INSERT INTO stock_movements (item_id, delta, reason, note, recipient_sub, ref_line_id, actor_sub, receipt_ym, created_at)
      VALUES (${m.itemId}, ${m.delta}, ${m.reason}, ${m.note}, ${m.recipientSub ?? null},
              ${m.refLineId ?? null}, ${actor}, ${m.receiptYm ? `${m.receiptYm}-01` : null}::date,
              coalesce(${m.at?.toISOString() ?? null}::timestamptz, now()))
      RETURNING id
    `);
    return rows[0];
  }

  private async record(
    tx: Tx,
    updated: { stock_qty: number } | undefined,
    actor: string,
    m: AuditedMovement,
  ): Promise<StockResult> {
    if (!updated) throw await this.rejection(tx, m.itemId);
    const movement = await this.insertMovement(tx, actor, m);
    await this.audit.appendWithin(tx, {
      actor,
      action: `stock.${m.reason}`,
      objectType: 'item',
      objectId: m.itemId,
      detail: {
        before: { stock_qty: updated.stock_qty - m.delta },
        after: { stock_qty: updated.stock_qty },
        delta: m.delta,
        note: m.note,
        movement_id: movement.id,
        ...(m.batchId ? { batch_id: m.batchId } : {}),
        ...(m.reason === 'issue'
          ? { recipient_sub: m.recipientSub, took_held: m.tookHeld ?? 0 }
          : {}),
      },
    });
    return { stock_qty: updated.stock_qty, movement_id: movement.id };
  }

  private async rejection(tx: Tx, itemId: string): Promise<Error> {
    const row = (
      await tx.execute<{ stock_qty: number }>(sql`
        SELECT stock_qty FROM items WHERE id = ${itemId}
      `)
    ).rows[0];
    if (!row) return itemNotFound();
    return new ConflictException({
      code: 'STOCK_INSUFFICIENT',
      message: 'Tồn kho không đủ.',
      available: row.stock_qty,
    });
  }

  private async assertActiveUser(sub: string): Promise<void> {
    const user = await this.users.findBySub(sub);
    if (!user) {
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: 'Không tìm thấy người nhận.',
      });
    }
    if (user.status !== 'active') {
      throw new ConflictException({
        code: 'USER_INACTIVE',
        message: 'Người nhận không còn hoạt động.',
      });
    }
  }
}
