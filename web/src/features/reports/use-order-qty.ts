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

  // Ô người dùng đã gõ: sai dạng hoặc vượt trần là lỗi; số khởi tạo/mặc định vượt trần chỉ là ghi chú
  const badText = (key: string, text: string) => {
    const n = parseOrderQty(text);
    return n === null || (touched.has(key) && n > ORDER_QTY_MAX);
  };
  const edited: Record<string, number> = {};
  let invalid = rejected.size > 0;
  for (const [key, text] of Object.entries(drafts)) {
    // Dòng đã rời báo cáo sau khi tải lại: nháp của nó không còn ô để hiện, không gửi
    if (!needs.has(key)) continue;
    const n = parseOrderQty(text);
    if (n === null || badText(key, text)) invalid = true;
    else if (n !== needs.get(key)) edited[key] = n;
  }
  const draftInvalid = (key: string) => key in drafts && badText(key, drafts[key]);
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
