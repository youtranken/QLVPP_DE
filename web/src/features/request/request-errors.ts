import { ApiError } from '@/lib/api-client';
import { apiErrorCode, apiErrorNumber } from '@/lib/api-error';
import { YM, shiftYm } from '@/lib/ym';
import type { CartLine } from './use-cart';

type T = (key: string, opts?: Record<string, unknown>) => string;

export type SaveFailure =
  | { kind: 'stale' }
  | { kind: 'lines'; byKey: Record<string, string> }
  | { kind: 'locked'; nextYm: string }
  | { kind: 'form'; message: string };

const LINE_CODES = new Set([
  'QTY_INVALID',
  'QTY_EXCEEDS_MAX',
  'QTY_BELOW_DELIVERED',
  'ITEM_INACTIVE',
  'ITEM_NOT_FOUND',
  'ADMIN_ONLY_ITEM',
  'DUPLICATE_ITEM',
  'LINE_READONLY',
  'LINE_NOT_FOUND',
  'IMAGE_REQUIRED',
  'UNIT_REQUIRED',
  'UNIT_INACTIVE',
  'FILE_FORBIDDEN',
]);

function stringField(e: unknown, key: string): string | undefined {
  const body = e instanceof ApiError && typeof e.body === 'object' && e.body ? (e.body as Record<string, unknown>) : {};
  return typeof body[key] === 'string' ? (body[key] as string) : undefined;
}

// Dòng mới chưa có id nên server trỏ bằng line_index = vị trí trong body, cùng thứ tự với giỏ
function lineKeyOf(e: unknown, lines: CartLine[]): string | undefined {
  const index = apiErrorNumber(e, 'line_index');
  if (index !== undefined) return lines[index]?.key;
  const id = stringField(e, 'line_id');
  return id ? lines.find((l) => l.id === id)?.key : undefined;
}


export function saveFailure(e: unknown, lines: CartLine[], t: T, ym: string): SaveFailure {
  const code = apiErrorCode(e);
  if (code === 'STALE_UPDATE') return { kind: 'stale' };
  if (code === 'PERIOD_LOCKED') {
    const next = stringField(e, 'next_ym');
    return { kind: 'locked', nextYm: next && YM.test(next) ? next : shiftYm(ym, 1) };
  }
  const key = lineKeyOf(e, lines);
  if (key) {
    const msg = t(`request.errors.line.${code && LINE_CODES.has(code) ? code : 'OTHER'}`, {
      max: apiErrorNumber(e, 'max'),
    });
    return { kind: 'lines', byKey: { [key]: msg } };
  }
  const known = code === 'LINES_EMPTY' || code === 'DUPLICATE_ITEM';
  return { kind: 'form', message: t(`request.errors.${known ? code : 'UNKNOWN'}`) };
}
