import { HttpException, Injectable } from '@nestjs/common';
import type { Tx } from '../../database/database.module';
import { AuditWriterService } from '../audit/audit-writer.service';
import type { RequestIdentity } from '../auth/identity.types';
import { LOCAL_SA_SUB } from '../auth/local-sa-env';
import { CatalogService } from '../catalog/catalog.service';
import { SystemConfigService } from '../config/system-config.service';
import { FilesService } from '../files/files.service';
import { PeriodsService } from '../periods/periods.service';
import { UsersService } from '../users/users.service';
import {
  constraintError,
  invalidPeriod,
  lineError,
  linesEmpty,
  periodLocked,
  reasonRequired,
  requestExists,
  staleUpdate,
  userNotFound,
} from './request-errors';
import { LineNotifier } from './line-notifier';
import { planLines } from './request-lines.diff';
import type { LinesPlan } from './request-lines.diff';
import { snapOf } from './request-lines.rules';
import type { LineRow, LineSnap, WriteMode } from './request-lines.rules';
import type { LinesPayload } from './request.dto';
import * as repo from './requests.repo';

export type LineSnapWithId = LineSnap & { id: string };

export interface LinesDiff {
  added: LineSnapWithId[];
  removed: LineSnapWithId[];
  changed: { id: string; before: LineSnap; after: LineSnap }[];
}

export interface SaveArgs {
  request: { id: string; user_sub: string; period_ym: string } | null;
  owner_sub: string;
  period_ym: string;
  actor: RequestIdentity;
  mode: WriteMode;
  body: LinesPayload;
  now: Date;
  // Tạo hộ: dòng là đăng ký của chủ phiếu → luật dòng như member, không đánh dấu added_by_admin
  on_behalf?: boolean;
}

const REASON_MIN = 3;

@Injectable()
export class RequestLinesWriter {
  constructor(
    private readonly periods: PeriodsService,
    private readonly users: UsersService,
    private readonly catalog: CatalogService,
    private readonly files: FilesService,
    private readonly config: SystemConfigService,
    private readonly audit: AuditWriterService,
    private readonly notifier: LineNotifier,
  ) {}

  async save(
    tx: Tx,
    args: SaveArgs,
  ): Promise<{ request_id: string | null; diff: LinesDiff }> {
    try {
      return await this.write(tx, args);
    } catch (error) {
      throw constraintError(error) ?? error;
    }
  }

  private async write(tx: Tx, args: SaveArgs) {
    // SA cục bộ là tài khoản IT khẩn cấp, không thuộc danh bạ → không có phiếu (tự lưu hay được tạo hộ)
    if (args.owner_sub === LOCAL_SA_SUB) throw userNotFound();
    await this.assertPeriod(tx, args);
    const owner = await this.users.findBySub(args.owner_sub);
    if (!owner) throw userNotFound();
    const head = await this.lockHead(tx, args, owner.department);
    const existing = await repo.lockLines(tx, head.id);
    const plan = await this.plan(tx, existing, args);
    await this.assertImagesOwned(tx, plan, args);
    const diff = await this.apply(tx, head.id, plan, args);
    if (!head.inserted && isEmpty(diff)) return { request_id: head.id, diff };

    const remaining =
      existing.length - plan.deletes.length + plan.inserts.length;
    if (remaining === 0) await repo.deleteRequest(tx, head.id);
    else await repo.touchRequest(tx, head.id, args.now, owner.department);
    const action =
      remaining === 0
        ? 'request.deleted'
        : head.inserted
          ? 'request.created'
          : 'request.updated';
    await this.audit.appendWithin(tx, {
      actor: args.actor.sub,
      action,
      objectType: 'request',
      objectId: head.id,
      detail: {
        ym: args.period_ym,
        owner_sub: args.owner_sub,
        ...diff,
        ...(args.mode === 'admin' && reason(args)
          ? { reason: reason(args) }
          : {}),
        self: args.actor.sub === args.owner_sub && args.mode === 'admin',
      },
    });
    await this.notifier.customLinesAdded(tx, {
      requestId: head.id,
      actorSub: args.actor.sub,
      lines: newCustomLines(plan, diff),
      now: args.now,
    });
    return { request_id: remaining === 0 ? null : head.id, diff };
  }

  private async lockHead(
    tx: Tx,
    args: SaveArgs,
    department: string | null,
  ): Promise<repo.RequestHead> {
    const expected = args.body.expected_updated_at;
    const head = args.request
      ? await repo.lockRequest(tx, args.request.id, expected)
      : await repo.upsertRequest(tx, {
          ym: args.period_ym,
          owner_sub: args.owner_sub,
          department,
          created_by: args.actor.sub,
          now: args.now,
          expected,
        });
    // Tạo hộ thua đua (phiếu vừa được tạo/lưu ở tx khác): báo phiếu đã có để mở Điều chỉnh
    if (args.on_behalf && head && !head.inserted) throw requestExists(head.id);
    // Phiếu đã có mà client không gửi đúng updated_at mới nhất → đang xem bản cũ
    const stale =
      !head || (head.inserted ? expected !== undefined : head.fresh !== true);
    if (stale) throw staleUpdate();
    if (head.inserted && args.body.lines.length === 0) throw linesEmpty();
    return head;
  }

  private async plan(
    tx: Tx,
    existing: LineRow[],
    args: SaveArgs,
  ): Promise<LinesPlan> {
    const ids = [
      ...args.body.lines.map((l) => l.item_id),
      ...existing.map((l) => l.item_id),
    ].filter((id): id is string => !!id);
    return planLines({
      existing,
      body: args.body.lines,
      mode: lineMode(args),
      items: await this.catalog.itemFacts([...new Set(ids)], tx),
      defaultMaxQty: await this.config.getInt('default_max_qty'),
    });
  }

  private async assertPeriod(tx: Tx, args: SaveArgs): Promise<void> {
    if (args.mode === 'member') {
      const open = await this.periods.openPeriod(tx, args.now);
      // 'YYYY-MM' so sánh chuỗi đúng thứ tự thời gian
      if (args.period_ym > open.ym) throw invalidPeriod();
      if (args.period_ym !== open.ym) throw periodLocked(open.ym);
      return;
    }
    const period = await this.periods.findSnapshot(args.period_ym, tx);
    if (!period) throw invalidPeriod();
    if (args.now < period.deadline) return;
    // BR-7: kỳ đã khóa chỉ sửa phiếu đã có, không tạo phiếu mới
    if (!args.request) {
      throw periodLocked((await this.periods.openPeriod(tx, args.now)).ym);
    }
    if ((reason(args)?.length ?? 0) < REASON_MIN) throw reasonRequired();
  }

  // Ảnh hợp lệ: người lưu tự tải, hoặc đã nằm trên dòng của chủ phiếu (chép lại dòng có ảnh Hành chính thay)
  private async assertImagesOwned(
    tx: Tx,
    plan: LinesPlan,
    args: SaveArgs,
  ): Promise<void> {
    const reusable = await repo.imagesOnOwnerLines(
      tx,
      [...new Set(plan.images.map((i) => i.fileId))],
      args.owner_sub,
    );
    for (const { fileId, ref } of plan.images) {
      if (reusable.has(fileId)) continue;
      try {
        await this.files.assertOwnedBy(fileId, args.actor.sub, 'line_image');
      } catch (error) {
        if (!(error instanceof HttpException)) throw error;
        throw lineError(
          'FILE_FORBIDDEN',
          'Không dùng được ảnh này.',
          ref,
          {},
          error.getStatus(),
        );
      }
    }
  }

  // Xóa trước để dòng mới cùng món không vướng chỉ mục duy nhất (request_id, item_id)
  private async apply(
    tx: Tx,
    requestId: string,
    plan: LinesPlan,
    args: SaveArgs,
  ): Promise<LinesDiff> {
    await repo.deleteLines(
      tx,
      plan.deletes.map((l) => l.id),
    );
    for (const { before, after } of plan.updates) {
      await repo.updateLine(tx, before.id, after, args.now);
    }
    const added: LineSnapWithId[] = [];
    for (const line of plan.inserts) {
      const id = await repo.insertLine(tx, requestId, {
        snap: line.snap,
        review_status: line.review_status,
        added_by_admin: lineMode(args) === 'admin',
        now: args.now,
      });
      added.push({ id, ...line.snap });
    }
    return {
      added,
      removed: plan.deletes.map(withId),
      changed: plan.updates.map(({ before, after }) => ({
        id: before.id,
        before: snapOf(before),
        after,
      })),
    };
  }
}

function lineMode(args: SaveArgs): WriteMode {
  return args.on_behalf ? 'member' : args.mode;
}

function reason(args: SaveArgs): string | undefined {
  return args.body.reason?.trim() || undefined;
}

// diff.added theo đúng thứ tự plan.inserts; chỉ dòng ngoài DM đang chờ duyệt mới báo Hành chính
function newCustomLines(plan: LinesPlan, diff: LinesDiff) {
  return diff.added
    .filter((_, i) => plan.inserts[i].review_status === 'pending')
    .map((l) => ({ id: l.id, name: l.custom_name! }));
}

function withId(line: LineRow): LineSnapWithId {
  return { id: line.id, ...snapOf(line) };
}

function isEmpty(diff: LinesDiff): boolean {
  return diff.added.length + diff.removed.length + diff.changed.length === 0;
}
