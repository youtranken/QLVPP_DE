import type { Dispatch, SetStateAction } from 'react';
import { apiErrorCode } from '@/lib/api-error';
import { deliverAll, deliverLine } from './delivery.api';
import { blockText, isBlockCode, lineErrorText, makesViewStale, reasonText, type DeliveryFailure } from './delivery-errors';
import { isSelectable, type LineError, type LineModel } from './delivery-lines';
import type { DeliveryOutcome } from './delivery-outcome';
import { failureInfo, type DeliverSelectedResult, type LineFailureInfo, type SelectedLine } from './use-deliver-selected';

type T = (key: string, opts?: Record<string, unknown>) => string;

export interface DeliveryCtx {
  t: T;
  requestId: string;
  csrfToken: string | null;
  month: number;
  lines: LineModel[];
  selected: ReadonlySet<string>;
  run: (what: string, task: (wasComplete: boolean) => Promise<void>) => Promise<void>;
  reload: () => Promise<unknown>;
  refreshStock: () => Promise<unknown>;
  versionNow: () => number;
  completeIf: (wasComplete: boolean, force?: boolean) => boolean;
  toastLine: (m: LineModel) => void;
  sendSelected: (lines: SelectedLine[]) => Promise<DeliverSelectedResult>;
  setErrors: Dispatch<SetStateAction<Record<string, LineError>>>;
  setSelected: Dispatch<SetStateAction<ReadonlySet<string>>>;
  setBlock: (text: string | null) => void;
  setOutcome: (o: DeliveryOutcome | null) => void;
}

const errorOf = (ctx: DeliveryCtx, m: LineModel, f: DeliveryFailure, version: number): LineError => ({
  text: lineErrorText(f, m.unit, ctx.t),
  cap: f.code === 'STOCK_INSUFFICIENT' ? (f.available ?? 0) : undefined,
  version,
});

// Lỗi gắn sau khi tải lại để còn hiện trên bản phiếu mới; STOCK_INSUFFICIENT chỉ cần tồn mới
async function onLineFailure(ctx: DeliveryCtx, m: LineModel, f: LineFailureInfo) {
  if (isBlockCode(f.code)) {
    ctx.setBlock(blockText(f.code, ctx.month, ctx.t));
    await ctx.reload();
    return;
  }
  if (makesViewStale(f.code)) await ctx.reload();
  else if (f.code === 'STOCK_INSUFFICIENT') void ctx.refreshStock();
  ctx.setErrors((e) => ({ ...e, [m.id]: errorOf(ctx, m, f, ctx.versionNow()) }));
}

export const deliverOne = (ctx: DeliveryCtx, m: LineModel) =>
  ctx.run(m.id, async (wasComplete) => {
    ctx.setErrors(({ [m.id]: _drop, ...rest }) => rest);
    try {
      const r = await deliverLine(m.id, { qty: m.qty, expected_delivered_qty: m.line.delivered_qty }, ctx.csrfToken);
      await ctx.reload();
      if (!ctx.completeIf(wasComplete, r?.request_complete === true)) ctx.toastLine(m);
    } catch (e) {
      await onLineFailure(ctx, m, failureInfo(m.id, e));
    }
  });

export const deliverPicked = (ctx: DeliveryCtx) =>
  ctx.run('selected', async (wasComplete) => {
    const picked = ctx.lines.filter((m) => isSelectable(m) && ctx.selected.has(m.id));
    const byId = new Map(picked.map((m) => [m.id, m]));
    const r = await ctx.sendSelected(picked.map((m) => ({ id: m.id, qty: m.qty, expectedDelivered: m.line.delivered_qty })));
    await ctx.reload();
    const version = ctx.versionNow();
    ctx.setErrors((prev) => {
      const next = Object.fromEntries(Object.entries(prev).filter(([id]) => !byId.has(id)));
      for (const f of r.failed) if (!isBlockCode(f.code)) next[f.id] = errorOf(ctx, byId.get(f.id)!, f, version);
      return next;
    });
    const blocking = r.failed.find((f) => isBlockCode(f.code));
    if (blocking) ctx.setBlock(blockText(blocking.code, ctx.month, ctx.t));
    ctx.setSelected((sel) => new Set([...sel].filter((id) => !r.delivered.includes(id))));
    const failed = r.failed.map((f) => ({ name: byId.get(f.id)!.name, reason: reasonText(f, ctx.t) }));
    ctx.setOutcome({ kind: 'selected', delivered: r.delivered.length, failed });
    if (r.delivered.length > 0) ctx.completeIf(wasComplete);
  });

export const deliverEverything = (ctx: DeliveryCtx) =>
  ctx.run('all', async (wasComplete) => {
    const nameOf = new Map(ctx.lines.map((m) => [m.id, m.name]));
    try {
      const r = await deliverAll(ctx.requestId, ctx.csrfToken);
      await ctx.reload();
      const failed = r.failed.map((f) => ({ name: nameOf.get(f.line_id) ?? '', reason: reasonText(f, ctx.t) }));
      ctx.setOutcome({ kind: 'all', delivered: r.delivered.length, failed });
      if (r.delivered.length > 0) ctx.completeIf(wasComplete);
    } catch (e) {
      ctx.setBlock(blockText(apiErrorCode(e) ?? '', ctx.month, ctx.t));
      await ctx.reload();
    }
  });
