import { ApiError } from '@/lib/api-client';
import { apiErrorCode, apiErrorNumber } from '@/lib/api-error';
import { cancelRemaining } from '../backlog.api';
import { deliverLine } from '../delivery.api';
import type { Step } from './deliver-plan';

export type LineOutcome =
  | { ok: true; kind: 'delivered'; qty: number }
  | { ok: true; kind: 'cancelled' }
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

const isExpired = (e: unknown) => e instanceof ApiError && (e.status === 401 || (e.status === 403 && apiErrorCode(e) === 'CSRF_INVALID'));

function runStep(step: Step, csrfToken: string | null): Promise<unknown> {
  const id = step.line.line_id;
  if (step.kind === 'deliver') return deliverLine(id, { qty: step.qty, expected_delivered_qty: step.line.delivered_qty }, csrfToken);
  return cancelRemaining(id, { reason_code: 'adm_out_of_stock', expected_delivered_qty: step.expectedDelivered, expected_qty: step.line.qty }, csrfToken);
}

// Tuần tự, mỗi dòng một request có expected_*; lỗi một dòng không chặn dòng sau, trừ khi phiên đã hết
export async function sendSteps(steps: Step[], csrfToken: string | null): Promise<SendResult> {
  const result: SendResult = { lines: [], expired: false };
  const failed = new Set<string>();
  for (const step of steps) {
    const lineId = step.line.line_id;
    if (result.expired) {
      result.lines.push({ lineId, outcome: { ok: false, code: NOT_SENT } });
      continue;
    }
    // Giao phần từ tủ lỗi thì không hủy phần còn lại: số đã giao chưa chắc
    if (step.kind === 'cancel' && failed.has(lineId)) continue;
    try {
      await runStep(step, csrfToken);
      result.lines.push({ lineId, outcome: step.kind === 'deliver' ? { ok: true, kind: 'delivered', qty: step.qty } : { ok: true, kind: 'cancelled' } });
    } catch (e) {
      failed.add(lineId);
      result.expired = isExpired(e);
      const code = result.expired ? NOT_SENT : e instanceof ApiError ? (apiErrorCode(e) ?? 'UNKNOWN') : NETWORK;
      result.lines.push({ lineId, outcome: { ok: false, code, available: apiErrorNumber(e, 'available'), remaining: apiErrorNumber(e, 'remaining') } });
    }
  }
  return result;
}
