import { Injectable } from '@nestjs/common';
import type { Tx } from '../../database/database.module';
import { eventIds } from '../notifications/notification-events';
import { NotificationsService } from '../notifications/notifications.service';
import { UsersService } from '../users/users.service';
import { vnDay } from '../../common/period';
import type { ItemFacts } from '../catalog/catalog-sql';
import type { AdjustReason } from './adjust-rules';
import * as adjustments from './line-adjustments.repo';
import * as repo from './requests.repo';

export interface ReviewedLine {
  lineId: string;
  requestId: string;
  customName: string | null;
  action: 'accepted' | 'converted' | 'rejected';
  note: string | null;
  noteCode?: string;
  item?: ItemFacts;
  now: Date;
}

const BELL_LINES = 5;

@Injectable()
export class LineNotifier {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly users: UsersService,
  ) {}

  async reviewed(tx: Tx, l: ReviewedLine): Promise<void> {
    const owner = await repo.requestOwner(tx, l.requestId);
    await this.notifications.notifyWithin(tx, {
      eventId: eventIds.lineReview(l.lineId),
      recipients: [owner.user_sub],
      topic: 'line_review',
      params: {
        ym: owner.ym,
        action: l.action,
        name: l.customName,
        ...(l.item
          ? { item_name: l.item.name, item_name_en: l.item.name_en }
          : {}),
        ...(l.note ? { note: l.note } : {}),
        ...(l.noteCode ? { note_code: l.noteCode } : {}),
      },
      link: `/history/${owner.ym}`,
      now: l.now,
    });
  }

  // Người đã nghỉ không đọc chuông nữa: mọi chuông điều chỉnh/hủy bỏ qua họ
  async ownerActive(userSub: string): Promise<boolean> {
    return (await this.ownerStatus(userSub)) === 'active';
  }

  async ownerStatus(userSub: string): Promise<string | null> {
    return (await this.users.findBySub(userSub))?.status ?? null;
  }

  // Gộp theo ngày: params tính lại từ mọi bản ghi trong ngày; lần lưu chỉ có user_left hoặc chủ phiếu đã nghỉ thì không chuông
  async linesAdjusted(
    tx: Tx,
    args: { userSub: string; ym: string; reasons: AdjustReason[]; now: Date },
  ): Promise<void> {
    if (args.reasons.every((r) => r === 'user_left')) return;
    if (!(await this.ownerActive(args.userSub))) return;
    const { day, from, to } = vnDay(args.now);
    const lines = await adjustments.dayBellLines(tx, {
      userSub: args.userSub,
      ym: args.ym,
      from,
      to,
    });
    if (lines.length === 0) return;
    await this.notifications.upsertWithin(tx, {
      eventId: eventIds.lineAdjusted(args.userSub, args.ym, day),
      userSub: args.userSub,
      kind: 'line_adjusted',
      params: {
        ym: args.ym,
        lines: lines.slice(0, BELL_LINES),
        more: Math.max(0, lines.length - BELL_LINES),
      },
      now: args.now,
    });
  }
}
