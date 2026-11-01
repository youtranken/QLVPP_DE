import { useCallback } from 'react';
import { apiErrorCode, apiErrorNumber } from '@/lib/api-error';
import { useMe } from '@/lib/me';
import { deliverLine } from './delivery.api';

export interface SelectedLine {
  id: string;
  qty: number;
  expectedDelivered: number;
}

export interface LineFailureInfo {
  id: string;
  code: string;
  available?: number;
  remaining?: number;
}

export interface DeliverSelectedResult {
  delivered: string[];
  failed: LineFailureInfo[];
}

export const failureInfo = (id: string, e: unknown): LineFailureInfo => ({
  id,
  code: apiErrorCode(e) ?? 'UNKNOWN',
  available: apiErrorNumber(e, 'available'),
  remaining: apiErrorNumber(e, 'remaining'),
});

// Mỗi dòng một request (một tx riêng, có expected_delivered_qty); lỗi một dòng không dừng các dòng sau
export async function deliverSelected(lines: SelectedLine[], csrfToken: string | null): Promise<DeliverSelectedResult> {
  const result: DeliverSelectedResult = { delivered: [], failed: [] };
  for (const line of lines) {
    try {
      await deliverLine(line.id, { qty: line.qty, expected_delivered_qty: line.expectedDelivered }, csrfToken);
      result.delivered.push(line.id);
    } catch (e) {
      result.failed.push(failureInfo(line.id, e));
    }
  }
  return result;
}

export function useDeliverSelected() {
  const { csrfToken } = useMe();
  return useCallback((lines: SelectedLine[]) => deliverSelected(lines, csrfToken), [csrfToken]);
}
