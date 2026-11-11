import { ApiError } from '@/lib/api-client';
import { apiErrorCode, apiErrorNumber, isSessionExpired } from '@/lib/api-error';
import { cancelRemaining } from '../backlog.api';
import { deliverLine } from '../delivery.api';
import type { Step } from './deliver-plan';
import { deliverBulk, type BulkDeliverBody, type DeliveryPersonLine } from './delivery-people.api';
import { REJECT_SKIPPED, withRejects } from './with-rejects';

export type LineOutcome =
  | { ok: true; kind: 'delivered'; qty: number }
  | { ok: true; kind: 'cancelled' }
  | { ok: true; kind: 'rejected' }
  | { ok: false; code: string; available?: number; remaining?: number };

export interface SentLine {
  lineId: string;
  outcome: LineOutcome;
}

export interface SendResult {
  lines: SentLine[];
  expired: boolean;
}

export const NOT_SENT = 'NOT_SENT';
export const NETWORK = 'NETWORK';

function runStep(step: Step, csrfToken: string | null): Promise<unknown> {
  const id = step.line.line_id;
  if (step.kind === 'deliver') return deliverLine(id, { qty: step.qty, expected_delivered_qty: step.line.delivered_qty }, csrfToken);
  return cancelRemaining(id, { reason_code: 'adm_out_of_stock', expected_delivered_qty: step.expectedDelivered, expected_qty: step.line.qty }, csrfToken);
}

const failure = (e: unknown, expired: boolean): LineOutcome => ({
  ok: false,
  code: expired ? NOT_SENT : e instanceof ApiError ? (apiErrorCode(e) ?? 'UNKNOWN') : NETWORK,
  available: apiErrorNumber(e, 'available'),
  remaining: apiErrorNumber(e, 'remaining'),
});

type Deliver = Extract<Step, { kind: 'deliver' }>;

// Phiếu có món ngoài danh mục chờ duyệt: giao các dòng của phiếu đó và ghi Không mua trong cùng một transaction
// (giao nhiều phiếu với reject_line_ids); cả phiếu cùng thành hoặc cùng hỏng
async function sendWithRejects(requestId: string, delivers: Deliver[], rejects: DeliveryPersonLine[], csrfToken: string | null): Promise<{ lines: SentLine[]; expired: boolean }> {
  const body: BulkDeliverBody = {
    requests: [
      {
        request_id: requestId,
        lines: delivers.map((d) => ({ line_id: d.line.line_id, qty: d.qty, expected_delivered_qty: d.line.delivered_qty })),
        reject_line_ids: rejects.map((l) => l.line_id),
      },
    ],
  };
  const ids = [...delivers.map((d) => d.line.line_id), ...rejects.map((l) => l.line_id)];
  try {
    const [r] = (await deliverBulk(body, csrfToken)).results;
    if (r?.ok) {
      return {
        expired: false,
        lines: [...delivers.map((d) => ({ lineId: d.line.line_id, outcome: { ok: true, kind: 'delivered', qty: d.qty } as const })), ...rejects.map((l) => ({ lineId: l.line_id, outcome: { ok: true, kind: 'rejected' } as const }))],
      };
    }
    const code = r?.code ?? 'UNKNOWN';
    // Lỗi gắn một dòng thì dòng đó mang lý do; các dòng khác của phiếu không ghi gì (rollback)
    const at = r?.line_id ?? ids[0];
    return { expired: false, lines: ids.map((lineId) => ({ lineId, outcome: lineId === at ? { ok: false, code, available: r?.available, remaining: r?.remaining } : { ok: false, code: NOT_SENT } })) };
  } catch (e) {
    const expired = isSessionExpired(e);
    return { expired, lines: ids.map((lineId) => ({ lineId, outcome: failure(e, expired) })) };
  }
}

interface Group {
  request_id: string;
  steps: Deliver[];
  reject_line_ids?: string[];
}

// Tuần tự theo đúng thứ tự hộp (nợ trước, kỳ cũ trước), mỗi dòng một request có expected_*; lỗi một dòng không chặn dòng sau,
// trừ khi phiên đã hết. rejects: món chờ duyệt hộp đã hỏi lại — đi cùng các dòng giao của chính phiếu đó (một transaction);
// người này đã có món giao lỗi thì không ghi Không mua
export async function sendSteps(steps: Step[], csrfToken: string | null, rejects: DeliveryPersonLine[] = []): Promise<SendResult> {
  const result: SendResult = { lines: [], expired: false };
  const failed = new Set<string>();
  const record = (lines: SentLine[]) => {
    for (const s of lines) {
      result.lines.push(s);
      if (!s.outcome.ok) failed.add(s.lineId);
    }
  };
  const notSent = (lines: { line_id: string }[], code = NOT_SENT) => record(lines.map((l) => ({ lineId: l.line_id, outcome: { ok: false, code } })));
  const runSingle = async (step: Step) => {
    const lineId = step.line.line_id;
    if (result.expired) return notSent([step.line]);
    // Giao phần từ tủ lỗi thì không hủy phần còn lại: số đã giao chưa chắc
    if (step.kind === 'cancel' && failed.has(lineId)) return;
    try {
      await runStep(step, csrfToken);
      record([{ lineId, outcome: step.kind === 'deliver' ? { ok: true, kind: 'delivered', qty: step.qty } : { ok: true, kind: 'cancelled' } }]);
    } catch (e) {
      result.expired = isSessionExpired(e);
      record([{ lineId, outcome: failure(e, result.expired) }]);
    }
  };
  // Dòng cùng phiếu nằm liền nhau trong hộp (xếp theo kỳ)
  const groups: Group[] = [];
  for (const step of steps) {
    if (step.kind !== 'deliver') continue;
    const last = groups.at(-1);
    if (last?.request_id === step.line.request_id) last.steps.push(step);
    else groups.push({ request_id: step.line.request_id, steps: [step] });
  }
  const planned = withRejects(groups, rejects, (id) => ({ request_id: id, steps: [] }), () => 'person');
  for (const g of planned) {
    const mine = rejects.filter((l) => g.reject_line_ids?.includes(l.line_id));
    if (mine.length === 0) {
      for (const step of g.steps) await runSingle(step);
    } else if (result.expired) {
      notSent([...g.steps.map((d) => d.line), ...mine]);
    } else if (failed.size > 0) {
      for (const step of g.steps) await runSingle(step);
      notSent(mine, REJECT_SKIPPED);
    } else {
      const sent = await sendWithRejects(g.request_id, g.steps, mine, csrfToken);
      result.expired = sent.expired;
      record(sent.lines);
    }
  }
  for (const step of steps) if (step.kind === 'cancel') await runSingle(step);
  return result;
}
