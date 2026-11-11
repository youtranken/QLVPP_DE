import { useMemo, useState } from 'react';
import { defaultOrder } from '@/lib/report-qty';
import { ORDER_QTY_MAX, type MonthReport, type ReportCustomRow, type ReportItemRow } from './reports.api';

const DIGITS = /^\d+$/;

// Số nguyên không âm; trần chỉ áp cho ô người dùng gõ (số hệ thống tính ra vượt trần vẫn giữ)
export function parseOrderQty(text: string): number | null {
  const s = text.trim();
  return DIGITS.test(s) ? Number(s) : null;
}

// Chỉ gửi ô đã sửa: ô để nguyên thì server lấy số mặc định tại lúc chốt; luật thật kiểm lại ở server
export type OrderQty = ReturnType<typeof useOrderQty>;
// invalid: sai dạng; max: người dùng gõ vượt trần; sent: số lấy từ bản đã gửi vượt trần và sẽ gửi đi
export type OrderError = 'invalid' | 'max' | 'sent';

interface Options {
  // Số mốc của ô (ô khác mốc = đã sửa); hàm phải ổn định giữa các lần render
  baseOf?: (r: ReportItemRow | ReportCustomRow) => number;
  initial?: Record<string, number>;
}

export function useOrderQty(report: MonthReport, { baseOf = defaultOrder, initial }: Options = {}) {
  const [drafts, setDrafts] = useState<Record<string, string>>(() =>
    Object.fromEntries(Object.entries(initial ?? {}).map(([k, v]) => [k, String(v)])),
  );
  const [rejected, setRejected] = useState<Set<string>>(() => new Set());
  const [touched, setTouched] = useState<ReadonlySet<string>>(() => new Set());
  const needs = useMemo(
    () => new Map([...report.byItem, ...report.custom].map((r) => [r.key, baseOf(r)])),
    [report, baseOf],
  );

  // Đúng luật server: số sẽ gửi đi (khác mặc định sống) mà vượt trần là lỗi; bằng mặc định thì không gửi, chỉ ghi chú vàng
  const draftError = (key: string): OrderError | null => {
    if (!(key in drafts)) return null;
    const n = parseOrderQty(drafts[key]);
    if (n === null) return 'invalid';
    if (n > ORDER_QTY_MAX && n !== needs.get(key)) return touched.has(key) ? 'max' : 'sent';
    return null;
  };
  const edited: Record<string, number> = {};
  let invalid = rejected.size > 0;
  for (const [key, text] of Object.entries(drafts)) {
    // Dòng đã rời báo cáo sau khi tải lại: nháp của nó không còn ô để hiện, không gửi
    if (!needs.has(key)) continue;
    const n = parseOrderQty(text);
    if (n === null || draftError(key)) invalid = true;
    else if (n !== needs.get(key)) edited[key] = n;
  }
  const draftInvalid = (key: string) => draftError(key) !== null;
  const errorOf = (key: string): OrderError | null => draftError(key) ?? (rejected.has(key) ? 'max' : null);
  const valueOf = (key: string) => drafts[key] ?? String(needs.get(key) ?? 0);
  const isEdited = (key: string) => key in edited || draftInvalid(key);
  const hasError = (key: string) => rejected.has(key) || draftInvalid(key);
  const keys = [...needs.keys()];
  const forget = (key: string) =>
    setTouched((s) => {
      if (!s.has(key)) return s;
      const next = new Set(s);
      next.delete(key);
      return next;
    });
  const clearRejected = (key: string) =>
    setRejected((s) => {
      if (!s.has(key)) return s;
      const next = new Set(s);
      next.delete(key);
      return next;
    });

  return {
    value: valueOf,
    set: (key: string, text: string) => {
      setDrafts((d) => ({ ...d, [key]: text }));
      setTouched((s) => (s.has(key) ? s : new Set(s).add(key)));
      clearRejected(key);
    },
    reset: (key: string) => {
      setDrafts((d) => Object.fromEntries(Object.entries(d).filter(([k]) => k !== key)));
      forget(key);
      clearRejected(key);
    },
    reject: (fields: string[]) =>
      setRejected(new Set(fields.filter((f) => f.startsWith('order_qty.')).map((f) => f.slice('order_qty.'.length)))),
    resetAll: () => {
      setDrafts({});
      setTouched(new Set());
      setRejected(new Set());
    },
    isEdited,
    hasError,
    errorOf,
    // Số hệ thống (mặc định/bản đã gửi) vượt trần mà người dùng chưa gõ: không chặn, chỉ nhắc kiểm lại
    overMax: (key: string) => !hasError(key) && (parseOrderQty(valueOf(key)) ?? 0) > ORDER_QTY_MAX,
    editedCount: keys.filter(isEdited).length,
    errorCount: keys.filter(hasError).length,
    edited,
    invalid,
    dirty: Object.keys(drafts).length > 0,
    drafts,
  };
}
