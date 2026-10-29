import { Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import type { Tx } from '../../database/database.module';
import { eventIds } from '../notifications/notification-events';
import { NotificationsService } from '../notifications/notifications.service';
import type { ItemFacts } from '../catalog/catalog-sql';

export interface ReviewedLine {
  lineId: string;
  requestId: string;
  customName: string | null;
  action: 'accepted' | 'converted' | 'rejected';
  note: string | null;
  item?: ItemFacts;
  now: Date;
}

export interface NewCustomLine {
  id: string;
  name: string;
}

@Injectable()
export class LineNotifier {
  constructor(private readonly notifications: NotificationsService) {}

  async reviewed(tx: Tx, l: ReviewedLine): Promise<void> {
    const owner = await ownerOf(tx, l.requestId);
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
      },
      link: `/history/${owner.ym}`,
      now: l.now,
    });
  }

  async customLinesAdded(
    tx: Tx,
    args: {
      requestId: string;
      actorSub: string;
      lines: NewCustomLine[];
      now: Date;
    },
  ): Promise<void> {
    if (args.lines.length === 0) return;
    const owner = await ownerOf(tx, args.requestId);
    const admins = (await this.notifications.adminRecipients(tx)).filter(
      (sub) => sub !== args.actorSub,
    );
    for (const line of args.lines) {
      await this.notifications.notifyWithin(tx, {
        eventId: eventIds.customLineNew(line.id),
        recipients: admins,
        topic: 'custom_line_new',
        params: { ym: owner.ym, name: line.name, person: owner.full_name },
        link: `/admin/review?ym=${owner.ym}`,
        now: args.now,
      });
    }
  }
}

async function ownerOf(tx: Tx, requestId: string) {
  const { rows } = await tx.execute<{
    user_sub: string;
    ym: string;
    full_name: string | null;
  }>(sql`
    SELECT r.user_sub, to_char(r.period_ym, 'YYYY-MM') AS ym, u.full_name
    FROM requests r LEFT JOIN users u ON u.sub = r.user_sub
    WHERE r.id = ${requestId}
  `);
  return rows[0];
}
