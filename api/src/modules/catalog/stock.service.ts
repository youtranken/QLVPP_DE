import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DRIZZLE_DB } from '../../database/database.module';
import type { Database } from '../../database/database.module';
import { AuditWriterService } from '../audit/audit-writer.service';
import { UsersService } from '../users/users.service';
import { itemNotFound } from './catalog.service';
import type { IssueDto, StockChangeDto } from './stock.dto';

type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];

export interface StockResult {
  stock_qty: number;
  movement_id: string;
}

interface MovementInput {
  itemId: string;
  delta: number;
  reason: 'purchase' | 'adjust' | 'issue';
  note: string | null;
  recipientSub?: string | null;
}

@Injectable()
export class StockService {
  constructor(
    @Inject(DRIZZLE_DB) private readonly db: Database,
    private readonly audit: AuditWriterService,
    private readonly users: UsersService,
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
    return this.db.transaction(async (tx) => {
      // Nhập mua đặt lại mốc sắp hết (FR-50) và cho phép cảnh báo gửi lại; điều chỉnh giữ mốc
      const purchase = dto.reason === 'purchase';
      const updated = await tx.execute<{ stock_qty: number }>(sql`
        UPDATE items SET stock_qty = stock_qty + ${dto.delta},
          restock_level = CASE WHEN ${purchase} THEN stock_qty + ${dto.delta}
                               ELSE restock_level END,
          low_stock_notified_at = CASE WHEN ${purchase} THEN NULL
                                       ELSE low_stock_notified_at END,
          updated_at = now()
        WHERE id = ${itemId} AND stock_qty + ${dto.delta} >= 0
        RETURNING stock_qty
      `);
      return this.record(tx, updated.rows[0], actor, {
        itemId,
        delta: dto.delta,
        reason: dto.reason,
        note: dto.note ?? null,
      });
    });
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
      return this.record(tx, updated.rows[0], actor, {
        itemId,
        delta: -dto.qty,
        reason: 'issue',
        note: dto.reason ?? null,
        recipientSub: dto.recipient_sub ?? null,
      });
    });
  }

  private async record(
    tx: Tx,
    updated: { stock_qty: number } | undefined,
    actor: string,
    m: MovementInput,
  ): Promise<StockResult> {
    if (!updated) throw await this.rejection(tx, m.itemId);
    const movement = (
      await tx.execute<{ id: string }>(sql`
        INSERT INTO stock_movements (item_id, delta, reason, note, recipient_sub, actor_sub)
        VALUES (${m.itemId}, ${m.delta}, ${m.reason}, ${m.note}, ${m.recipientSub ?? null}, ${actor})
        RETURNING id
      `)
    ).rows[0];
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
        ...(m.reason === 'issue' ? { recipient_sub: m.recipientSub } : {}),
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

function reasonRequired() {
  return new BadRequestException({
    code: 'REASON_REQUIRED',
    message: 'Cần ghi lý do.',
  });
}
