import { BadRequestException, HttpStatus } from '@nestjs/common';
import { lineError } from './request-errors';
import type { LineRow } from './request-lines.rules';

export const ADJUST_REASONS = [
  'over_quota',
  'adm_out_of_stock',
  'duplicate',
  'user_left',
  'other',
  'cannot_buy',
  // Hành chính bấm X bỏ cả dòng: chỉ hợp lệ khi về 0
  'removed',
] as const;
export type AdjustReason = (typeof ADJUST_REASONS)[number];
export const REASON_NOTE_MAX = 200;
const OTHER_NOTE_MIN = 3;

export interface AdjustInput {
  id?: string;
  qty: number;
  expected_qty?: number;
  reason_code?: unknown;
  reason_note?: unknown;
}

export interface AdjustLine {
  id?: string;
  qty: number;
  expected_qty?: number;
  reason_code: AdjustReason | null;
  reason_note: string | null;
}

export interface AdjustChange {
  before: LineRow;
  after: number;
  reason_code: AdjustReason;
  reason_note: string | null;
}

interface Pending extends Omit<AdjustChange, 'reason_code'> {
  reason_code: AdjustReason | null;
}

type Sent = Map<string, { before: LineRow; line: AdjustLine }>;

// Độ dài theo mã điểm như char_length của Postgres, không theo UTF-16
const codePoints = (s: string) => [...s].length;

// "Khác" phải có ghi chú ≥ 3 chữ: một luật cho giảm phiếu và hủy nợ
export const otherNoteTooShort = (code: string | null, note: string | null) =>
  code === 'other' && codePoints(note ?? '') < OTHER_NOTE_MIN;

export function normalizeNote(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const note = raw.normalize('NFC').trim();
  return note === '' ? null : note;
}

const invalid = (field: string, message: string, index: number) =>
  new BadRequestException({
    code: 'VALIDATION',
    message,
    fields: [`lines.${field}`],
    line_index: index,
  });

export function parseAdjustLines(lines: AdjustInput[]): AdjustLine[] {
  return lines.map((raw, index) => {
    const code = raw.reason_code ?? null;
    if (code !== null && !ADJUST_REASONS.includes(code as AdjustReason)) {
      throw invalid('reason_code', 'Lý do giảm không hợp lệ.', index);
    }
    const rawNote = raw.reason_note ?? null;
    if (rawNote !== null && typeof rawNote !== 'string') {
      throw invalid('reason_note', 'Ghi chú phải là chữ.', index);
    }
    const note = normalizeNote(rawNote);
    if (note !== null && codePoints(note) > REASON_NOTE_MAX) {
      throw invalid(
        'reason_note',
        `Ghi chú tối đa ${REASON_NOTE_MAX} ký tự.`,
        index,
      );
    }
    return {
      id: raw.id,
      qty: raw.qty,
      expected_qty: raw.expected_qty,
      reason_code: code as AdjustReason | null,
      reason_note: note,
    };
  });
}

// Mỗi tầng kiểm chạy trên mọi dòng rồi mới sang tầng sau: lỗi trả về luôn là lỗi đứng đầu thứ tự quy định
export function planAdjust(
  existing: LineRow[],
  lines: AdjustLine[],
): AdjustChange[] {
  const sent = matchLines(existing, lines);
  for (const [id, { before, line }] of sent) {
    if (line.expected_qty !== before.qty) {
      throw lineError(
        'STALE_UPDATE',
        'Phiếu vừa được người khác sửa — tải lại.',
        { line_id: id },
        { qty: before.qty },
        HttpStatus.CONFLICT,
      );
    }
  }
  const missing = existing.find((l) => !sent.has(l.id));
  if (missing) {
    throw lineError('LINE_MISSING', 'Thiếu dòng trong phiếu gửi lên.', {
      line_id: missing.id,
    });
  }
  assertNoAddOrIncrease(lines, sent);
  const reduced: Pending[] = existing.flatMap((before) => {
    const { line } = sent.get(before.id)!;
    if (line.qty >= before.qty) return [];
    return [
      {
        before,
        after: line.qty,
        reason_code: line.reason_code,
        reason_note: line.reason_note,
      },
    ];
  });
  reduced.forEach(assertFloor);
  return reduced.map(withReason);
}

function matchLines(existing: LineRow[], lines: AdjustLine[]): Sent {
  const byId = new Map(existing.map((l) => [l.id, l]));
  const sent: Sent = new Map();
  lines.forEach((line, index) => {
    if (line.id === undefined) return;
    const before = byId.get(line.id);
    if (!before || sent.has(line.id)) {
      throw lineError('LINE_NOT_FOUND', 'Dòng không thuộc phiếu này.', {
        line_index: index,
      });
    }
    sent.set(line.id, { before, line });
  });
  return sent;
}

function assertNoAddOrIncrease(lines: AdjustLine[], sent: Sent): void {
  lines.forEach((line, index) => {
    if (line.id === undefined) {
      throw lineError(
        'LINE_ADD_FORBIDDEN',
        'Kỳ đã khóa sổ — không thêm món được.',
        { line_index: index },
      );
    }
    if (line.qty > sent.get(line.id)!.before.qty) {
      throw lineError(
        'QTY_INCREASE_FORBIDDEN',
        'Kỳ đã khóa sổ — không tăng số được.',
        { line_id: line.id },
      );
    }
  });
}

function assertFloor({ before, after }: Pending): void {
  if (after < before.delivered_qty + before.cancelled_qty) {
    throw lineError(
      'QTY_BELOW_DELIVERED',
      'Ít hơn số đã giao.',
      { line_id: before.id },
      { delivered: before.delivered_qty },
    );
  }
}

function withReason(change: Pending): AdjustChange {
  const ref = { line_id: change.before.id };
  const code = change.reason_code;
  if (code === null) {
    throw lineError('REASON_REQUIRED', 'Chọn lý do giảm.', ref);
  }
  if (code === 'removed' && change.after !== 0) {
    throw lineError(
      'REASON_REQUIRED',
      '"Bỏ khỏi phiếu" chỉ dùng khi bỏ cả dòng.',
      ref,
    );
  }
  if (otherNoteTooShort(code, change.reason_note)) {
    throw lineError(
      'REASON_REQUIRED',
      'Chọn "Khác" thì ghi lý do, ít nhất 3 chữ.',
      ref,
    );
  }
  return { ...change, reason_code: code };
}
