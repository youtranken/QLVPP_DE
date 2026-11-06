import type { Executor } from '../../database/database.module';
import { requestAdjustments } from './line-adjustments.repo';
import type { MemberAdjustment } from './line-adjustments.repo';
import type { LineView, RequestView } from './request-view';

type LineAdjustment = Pick<
  MemberAdjustment,
  'before' | 'after' | 'reason_code' | 'reason_note' | 'at'
>;
type RemovedLine = Omit<MemberAdjustment, 'line_id' | 'after'>;

export type MemberRequestView = Omit<RequestView, 'lines'> & {
  lines: (LineView & { adjustments: LineAdjustment[] })[];
  removed_lines: RemovedLine[];
  removed_all: boolean;
};

// Kỳ đang mở Hành chính không điều chỉnh được → không đọc bản ghi, nhân viên không thấy gì của Hành chính
export async function withAdjustments(
  ex: Executor,
  view: RequestView,
): Promise<MemberRequestView> {
  const records = view.is_open ? [] : await requestAdjustments(ex, view.id);
  const kept = new Set(view.lines.map((l) => l.id));
  const removed = records
    .filter((r) => r.after === 0 && !kept.has(r.line_id))
    .map(({ name, name_en, unit, before, reason_code, reason_note, at }) => ({
      name,
      name_en,
      unit,
      before,
      reason_code,
      reason_note,
      at,
    }));
  return {
    ...view,
    lines: view.lines.map((l) => ({
      ...l,
      adjustments: records
        .filter((r) => r.line_id === l.id)
        .map(({ before, after, reason_code, reason_note, at }) => ({
          before,
          after,
          reason_code,
          reason_note,
          at,
        })),
    })),
    removed_lines: removed,
    removed_all: view.lines.length === 0 && removed.length > 0,
  };
}
