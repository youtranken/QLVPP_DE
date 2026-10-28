import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { ClockService } from '../../common/clock.service';
import { ymToDate } from '../../common/period';
import { DRIZZLE_DB } from '../../database/database.module';
import type { Database, Tx } from '../../database/database.module';
import { AuditWriterService } from '../audit/audit-writer.service';
import type { RequestIdentity } from '../auth/identity.types';
import type { CreateItemDto } from '../catalog/catalog.dto';
import type { ItemFacts, ItemRow } from '../catalog/catalog-sql';
import { CatalogService, itemNotFound } from '../catalog/catalog.service';
import {
  lineAlreadyReviewed,
  lineNotFound,
  rejectReasonRequired,
} from './request-errors';
import type { LineRow } from './request-lines.rules';
import { toLineView } from './request-view';
import type { LineView } from './request-view';
import * as repo from './requests.repo';
import type {
  ReviewAction,
  ReviewBody,
  ReviewItemInput,
  ReviewListQuery,
} from './review.dto';

export interface ReviewRow {
  line_id: string;
  request_id: string;
  period_ym: string;
  user_sub: string;
  full_name: string | null;
  department: string | null;
  item_id: string | null;
  custom_name: string | null;
  custom_unit: string | null;
  custom_note: string | null;
  image_file_id: string | null;
  qty: number;
  review_status: string;
  review_note: string | null;
  previously_accepted: boolean;
  created_at: string;
}

export interface ReviewResult {
  line: LineView;
  request_updated_at: string;
  item?: ItemFacts;
  unit_mismatch?: boolean;
}

const STATUS_OF: Record<ReviewAction, string> = {
  accept: 'accepted',
  convert: 'converted',
  reject: 'rejected',
};
const AUDIT_KEYS = [
  'review_status',
  'review_note',
  'item_id',
  'custom_name',
  'custom_unit',
  'custom_note',
] as const;

@Injectable()
export class ReviewService {
  constructor(
    @Inject(DRIZZLE_DB) private readonly db: Database,
    private readonly clock: ClockService,
    private readonly catalog: CatalogService,
    private readonly audit: AuditWriterService,
  ) {}

  // previously_accepted: cùng người đã có dòng accepted cùng tên (chuẩn hóa) ở kỳ nào đó trước kỳ này
  async list(query: ReviewListQuery): Promise<{ items: ReviewRow[] }> {
    const ym = query.ym ? ymToDate(query.ym) : null;
    const { rows } = await this.db.execute<
      ReviewRow & Record<string, unknown>
    >(sql`
      SELECT l.id AS line_id, l.request_id, to_char(r.period_ym, 'YYYY-MM') AS period_ym,
             r.user_sub, u.full_name, r.department, l.item_id, l.custom_name, l.custom_unit,
             l.custom_note, l.image_file_id, l.qty, l.review_status, l.review_note,
             EXISTS (
               SELECT 1 FROM request_lines pl JOIN requests pr ON pr.id = pl.request_id
               WHERE pr.user_sub = r.user_sub AND pr.period_ym < r.period_ym
                 AND pl.review_status = 'accepted'
                 AND lower(trim(pl.custom_name)) = lower(trim(l.custom_name))
             ) AS previously_accepted,
             l.created_at
      FROM request_lines l
      JOIN requests r ON r.id = l.request_id
      LEFT JOIN users u ON u.sub = r.user_sub
      WHERE l.review_status = ${query.status}
        AND (${ym}::date IS NULL OR r.period_ym = ${ym}::date)
      ORDER BY r.period_ym, l.created_at, l.id
    `);
    return { items: rows };
  }

  async review(
    admin: RequestIdentity,
    lineId: string,
    body: ReviewBody,
  ): Promise<ReviewResult> {
    const note = body.note?.trim() || null;
    if (body.action === 'reject' && (note?.length ?? 0) < 3) {
      throw rejectReasonRequired();
    }
    if (body.action === 'convert') assertOneTarget(body.item);
    const now = this.clock.now();
    return this.db.transaction(async (tx) => {
      const before = await repo.lockLineForReview(tx, lineId);
      if (!before) throw lineNotFound();
      if (before.review_status !== 'pending') throw lineAlreadyReviewed();
      const item =
        body.action === 'convert'
          ? await this.targetItem(tx, before, body.item!, admin.sub)
          : undefined;
      const after = await repo.setReview(tx, lineId, {
        status: STATUS_OF[body.action],
        note: note ?? (item ? `Từ: ${before.custom_name}` : null),
        itemId: item?.id ?? null,
        by: admin.sub,
        now,
      });
      // Không xảy ra khi đã khóa ở trên; giữ để điều kiện pending là luật của chính câu UPDATE
      if (!after) throw lineAlreadyReviewed();
      const updatedAt = await repo.bumpRequest(tx, before.request_id, now);
      await this.audit.appendWithin(tx, {
        actor: admin.sub,
        action: 'line.review',
        objectType: 'request_line',
        objectId: lineId,
        detail: {
          action: body.action,
          before: pickReview(before),
          after: pickReview(after),
          ...(item ? { item_id: item.id } : {}),
        },
      });
      const facts = item
        ? await this.catalog.itemFacts([item.id], tx)
        : new Map<string, ItemFacts>();
      // Món có sẵn hay món mới đều trả cùng hình ItemFacts
      const target = item ? facts.get(item.id)! : undefined;
      return {
        line: toLineView(after, facts),
        request_updated_at: updatedAt,
        ...(target
          ? { item: target, unit_mismatch: target.unit !== before.custom_unit }
          : {}),
      };
    });
  }

  // Món mới: tồn 0, không biến động kho; ảnh mặc định = ảnh dòng (member tải) nên không kiểm chủ
  private async targetItem(
    tx: Tx,
    line: LineRow,
    input: ReviewItemInput,
    actor: string,
  ): Promise<ItemFacts | ItemRow> {
    if (input.existing_id) {
      const found = (await this.catalog.itemFacts([input.existing_id], tx)).get(
        input.existing_id,
      );
      if (!found) throw itemNotFound();
      if (!found.active) {
        throw new BadRequestException({
          code: 'ITEM_INACTIVE',
          message: 'Món đã ngừng.',
        });
      }
      return found;
    }
    const dto: CreateItemDto = {
      name: input.name!,
      name_en: input.name_en,
      unit: input.unit,
      pack_note: input.pack_note,
      category_id: input.category_id,
      image_file_id: input.image_file_id ?? line.image_file_id,
      max_qty: input.max_qty,
      admin_only: input.admin_only,
    };
    return this.catalog.createItemWithin(tx, dto, actor, {
      trustedImageId: line.image_file_id ?? undefined,
    });
  }
}

const NEW_ITEM_KEYS = [
  'name',
  'name_en',
  'unit',
  'pack_note',
  'category_id',
  'image_file_id',
  'max_qty',
  'admin_only',
] as const;

// Hoặc {existing_id} hoặc trường món mới — gửi cả hai là mơ hồ, không đoán ý admin
function assertOneTarget(item: ReviewItemInput | undefined): void {
  const mixed = item?.existing_id
    ? NEW_ITEM_KEYS.filter((k) => item[k] !== undefined)
    : [];
  if (!item || mixed.length > 0) {
    throw new BadRequestException({
      code: 'VALIDATION',
      message: 'Chọn món có sẵn hoặc nhập món mới (không cả hai).',
      fields: item ? mixed : ['item'],
    });
  }
}

function pickReview(line: LineRow): Record<string, unknown> {
  return Object.fromEntries(AUDIT_KEYS.map((k) => [k, line[k]]));
}
