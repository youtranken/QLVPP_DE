import { Inject, Injectable } from '@nestjs/common';
import { ClockService } from '../../common/clock.service';
import { DRIZZLE_DB } from '../../database/database.module';
import type { Database, Tx } from '../../database/database.module';
import { AuditWriterService } from '../audit/audit-writer.service';
import type { RequestIdentity } from '../auth/identity.types';
import { CatalogService } from '../catalog/catalog.service';
import { PeriodsService } from '../periods/periods.service';
import { parseAdjustLines, planAdjust } from './adjust-rules';
import type { AdjustChange, AdjustLine } from './adjust-rules';
import * as adjustments from './line-adjustments.repo';
import type { AdjustmentRecord } from './line-adjustments.repo';
import { LineNotifier } from './line-notifier';
import { requestNotFound, staleUpdate } from './request-errors';
import { snapOf } from './request-lines.rules';
import { RequestViewBuilder } from './request-view';
import type { RequestView } from './request-view';
import type { SaveLinesBody } from './request.dto';
import * as repo from './requests.repo';

type AuditAdjustment = Omit<AdjustmentRecord, 'unit'>;

export interface AdjustResult {
  request: RequestView | null;
  adjustments: AuditAdjustment[];
}

@Injectable()
export class AdminRequestService {
  constructor(
    @Inject(DRIZZLE_DB) private readonly db: Database,
    private readonly clock: ClockService,
    private readonly periods: PeriodsService,
    private readonly catalog: CatalogService,
    private readonly audit: AuditWriterService,
    private readonly notifier: LineNotifier,
    private readonly views: RequestViewBuilder,
  ) {}

  async saveLines(
    admin: RequestIdentity,
    id: string,
    body: SaveLinesBody,
  ): Promise<AdjustResult> {
    const lines = parseAdjustLines(body.lines);
    const now = this.clock.now();
    return this.db.transaction(async (tx) => {
      const found = await repo.findRequest(tx, { id }, true);
      if (!found) throw requestNotFound('Không tìm thấy phiếu.');
      // Kỳ của phiếu xác định sau FOR UPDATE, cùng tx
      await this.periods.assertLocked(found.period_ym, now, tx);
      const changes = await this.plan(tx, id, body.expected_updated_at, lines);
      if (changes.length === 0) {
        return {
          request: await this.views.build(tx, id, false),
          adjustments: [],
        };
      }
      const records = await this.records(tx, changes);
      await this.apply(tx, found, changes, now);
      const batchId = await this.audit.appendWithin(tx, {
        actor: admin.sub,
        action: 'request.updated',
        objectType: 'request',
        objectId: id,
        detail: auditDetail(found, changes, records, admin.sub),
        at: now,
      });
      await adjustments.insertAdjustments(tx, {
        batchId,
        ym: found.period_ym,
        userSub: found.user_sub,
        requestId: id,
        actorSub: admin.sub,
        now,
        records,
      });
      await this.notifier.linesAdjusted(tx, {
        userSub: found.user_sub,
        ym: found.period_ym,
        reasons: records.map((r) => r.reason_code),
        now,
      });
      return {
        request: await this.views.build(tx, id, false),
        adjustments: records.map(forAudit),
      };
    });
  }

  private async plan(
    tx: Tx,
    id: string,
    expectedUpdatedAt: string,
    lines: AdjustLine[],
  ): Promise<AdjustChange[]> {
    const head = await repo.lockRequest(tx, id, expectedUpdatedAt);
    if (head?.fresh !== true) throw staleUpdate();
    await repo.lockLines(tx, id);
    // Đã khóa theo id; đọc lại theo thứ tự hiển thị để "dòng đầu" trong lỗi khớp màn hình
    return planAdjust(await repo.listLines(tx, id), lines);
  }

  // Tên/ĐVT chụp lúc điều chỉnh: dòng có thể bị xóa, món có thể đổi tên sau này
  private async records(
    tx: Tx,
    changes: AdjustChange[],
  ): Promise<AdjustmentRecord[]> {
    const ids = changes
      .map((c) => c.before.item_id)
      .filter((x): x is string => !!x);
    const items = await this.catalog.itemFacts([...new Set(ids)], tx);
    return changes.map(({ before, after, reason_code, reason_note }) => {
      const item = before.item_id ? items.get(before.item_id) : undefined;
      return {
        line_id: before.id,
        item_id: before.item_id,
        name: item?.name ?? before.custom_name ?? '',
        unit: item?.unit ?? before.custom_unit ?? '',
        before: before.qty,
        after,
        reason_code,
        reason_note,
      };
    });
  }

  // Bỏ hết dòng vẫn giữ phiếu: người đó vẫn tính đã đăng ký
  private async apply(
    tx: Tx,
    found: repo.RequestRow,
    changes: AdjustChange[],
    now: Date,
  ): Promise<void> {
    await repo.deleteLines(
      tx,
      changes.filter((c) => c.after === 0).map((c) => c.before.id),
    );
    for (const c of changes.filter((x) => x.after > 0)) {
      await repo.updateLine(
        tx,
        c.before.id,
        { ...snapOf(c.before), qty: c.after },
        now,
      );
    }
    await repo.touchRequest(tx, found.id, now, found.department);
  }
}

function auditDetail(
  found: repo.RequestRow,
  changes: AdjustChange[],
  records: AdjustmentRecord[],
  actorSub: string,
): Record<string, unknown> {
  return {
    ym: found.period_ym,
    owner_sub: found.user_sub,
    added: [],
    removed: changes
      .filter((c) => c.after === 0)
      .map((c) => ({ id: c.before.id, ...snapOf(c.before) })),
    changed: changes
      .filter((c) => c.after > 0)
      .map((c) => ({
        id: c.before.id,
        before: snapOf(c.before),
        after: { ...snapOf(c.before), qty: c.after },
      })),
    adjustments: records.map(forAudit),
    self: actorSub === found.user_sub,
  };
}

function forAudit(r: AdjustmentRecord): AuditAdjustment {
  return {
    line_id: r.line_id,
    item_id: r.item_id,
    name: r.name,
    before: r.before,
    after: r.after,
    reason_code: r.reason_code,
    reason_note: r.reason_note,
  };
}
