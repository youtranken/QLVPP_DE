import { Injectable } from '@nestjs/common';
import type { Tx } from '../../database/database.module';
import { AuditWriterService } from '../audit/audit-writer.service';
import type { ItemFacts } from '../catalog/catalog-sql';
import { LineNotifier } from './line-notifier';
import { lineAlreadyReviewed, pendingCustomChanged } from './request-errors';
import type { LineRow } from './request-lines.rules';
import * as repo from './requests.repo';
import * as reviewRepo from './review-lines.repo';
import type { ReviewAction } from './review.dto';

export type LockedLine = LineRow & { request_id: string };

// review_note lưu mã, web dịch vi/en: nhân viên đọc lý do theo ngôn ngữ của mình
export const AUTO_REJECT_NOTE = 'auto:not_approved';
export const AUTO_REJECT_CODE = 'not_approved';

const STATUS_OF: Record<ReviewAction, 'accepted' | 'converted' | 'rejected'> = {
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

interface ApplyReview {
  action: ReviewAction;
  note: string | null;
  // Ghi chú chuông theo mã (thay cho note gõ tay)
  noteCode?: string;
  item?: ItemFacts;
  actor: string;
  ym: string | null;
  now: Date;
  auto?: boolean;
}

export interface PendingConfirm {
  reject_pending_custom?: boolean;
  expected_pending?: number;
}

// Ghi một quyết định duyệt trên dòng đã khóa (requests → request_lines): cập nhật dòng, phiếu, audit, chuông chủ phiếu
@Injectable()
export class ReviewWriter {
  constructor(
    private readonly audit: AuditWriterService,
    private readonly notifier: LineNotifier,
  ) {}

  async applyWithin(
    tx: Tx,
    before: LockedLine,
    r: ApplyReview,
  ): Promise<{ after: LineRow; updatedAt: string }> {
    const lineId = before.id;
    const after = await reviewRepo.setReview(tx, lineId, {
      status: STATUS_OF[r.action],
      note: r.note,
      itemId: r.item?.id ?? null,
      by: r.actor,
      now: r.now,
    });
    // Người gọi đã khóa dòng còn chờ; giữ để điều kiện pending là luật của chính câu UPDATE
    if (!after) throw lineAlreadyReviewed();
    const updatedAt = await repo.bumpRequest(tx, before.request_id, r.now);
    await this.audit.appendWithin(tx, {
      actor: r.actor,
      action: 'line.review',
      objectType: 'request_line',
      objectId: lineId,
      detail: {
        ym: r.ym,
        action: r.action,
        ...(r.auto ? { auto: true } : {}),
        before: pickReview(before),
        after: pickReview(after),
        ...(r.item ? { item_id: r.item.id } : {}),
      },
      at: r.now,
    });
    await this.notifier.reviewed(tx, {
      lineId,
      requestId: before.request_id,
      customName: before.custom_name,
      action: STATUS_OF[r.action],
      note: r.noteCode ? null : r.note,
      noteCode: r.noteCode,
      item: r.item,
      now: r.now,
    });
    return { after, updatedAt };
  }

  // App tự ghi Không mua (chốt kỳ, giao hàng): lý do là mã để nhân viên đọc theo ngôn ngữ của mình
  rejectWithin(
    tx: Tx,
    line: LockedLine,
    r: { actor: string; ym: string; now: Date },
  ) {
    return this.applyWithin(tx, line, {
      action: 'reject',
      note: AUTO_REJECT_NOTE,
      noteCode: AUTO_REJECT_CODE,
      actor: r.actor,
      ym: r.ym,
      now: r.now,
      auto: true,
    });
  }

  // Giao hàng ghi Không mua đúng các dòng chờ mà hộp giao đã hiện; người gọi đã khóa phiếu rồi các dòng và kiểm còn chờ
  async rejectLinesWithin(
    tx: Tx,
    requestId: string,
    lineIds: string[],
    r: { actor: string; ym: string; now: Date },
  ): Promise<void> {
    if (lineIds.length === 0) return;
    const lines = await reviewRepo.linesOf(tx, requestId, lineIds);
    for (const line of lines) await this.rejectWithin(tx, line, r);
  }

  // Chốt kỳ không để món ngoài danh mục treo: client phải xác nhận đúng số món đang thấy, lệch → 409 PENDING_CUSTOM
  async rejectPendingWithin(
    tx: Tx,
    ym: string,
    confirm: PendingConfirm,
    r: { actor: string; now: Date },
  ): Promise<number> {
    const lines = await reviewRepo.lockPendingLines(tx, ym);
    const expected = confirm.expected_pending;
    const confirmed =
      lines.length === 0
        ? expected === undefined || expected === 0
        : confirm.reject_pending_custom === true && expected === lines.length;
    if (!confirmed) throw pendingCustomChanged(lines.length);
    for (const line of lines) {
      await this.rejectWithin(tx, line, { ...r, ym });
    }
    return lines.length;
  }
}

function pickReview(line: LineRow): Record<string, unknown> {
  return Object.fromEntries(AUDIT_KEYS.map((k) => [k, line[k]]));
}
