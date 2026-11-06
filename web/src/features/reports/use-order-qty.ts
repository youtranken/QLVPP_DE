import { useMemo, useState } from 'react';
import { defaultOrder } from '@/lib/report-qty';
import { ORDER_QTY_MAX, type MonthReport, type ReportCustomRow, type ReportItemRow } from './reports.api';

const DIGITS = /^\d+$/;

export function parseOrderQty(text: string): number | null {
  const s = text.trim();
  if (!DIGITS.test(s)) return null;
  const n = Number(s);
  return n <= ORDER_QTY_MAX ? n : null;
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
  const needs = useMemo(
    () => new Map([...report.byItem, ...report.custom].map((r) => [r.key, baseOf(r)])),
    [report, baseOf],
  );

  const edited: Record<string, number> = {};
  let invalid = rejected.size > 0;
  for (const [key, text] of Object.entries(drafts)) {
    // Dòng đã rời báo cáo sau khi tải lại: nháp của nó không còn ô để hiện, không gửi
    if (!needs.has(key)) continue;
    const n = parseOrderQty(text);
    if (n === null) invalid = true;
    else if (n !== needs.get(key)) edited[key] = n;
  }
  const draftInvalid = (key: string) => key in drafts && parseOrderQty(drafts[key]) === null;
  const isEdited = (key: string) => key in edited || draftInvalid(key);
  const hasError = (key: string) => rejected.has(key) || draftInvalid(key);
  const keys = [...needs.keys()];
  const clearRejected = (key: string) =>
    setRejected((s) => {
      if (!s.has(key)) return s;
      const next = new Set(s);
      next.delete(key);
      return next;
    });

  return {
    value: (key: string) => drafts[key] ?? String(needs.get(key) ?? 0),
    set: (key: string, text: string) => {
      setDrafts((d) => ({ ...d, [key]: text }));
      clearRejected(key);
    },
    reset: (key: string) => {
      setDrafts((d) => Object.fromEntries(Object.entries(d).filter(([k]) => k !== key)));
      clearRejected(key);
    },
    reject: (fields: string[]) =>
      setRejected(new Set(fields.filter((f) => f.startsWith('order_qty.')).map((f) => f.slice('order_qty.'.length)))),
    resetAll: () => {
      setDrafts({});
      setRejected(new Set());
    },
    isEdited,
    hasError,
    editedCount: keys.filter(isEdited).length,
    errorCount: keys.filter(hasError).length,
    edited,
    invalid,
    dirty: Object.keys(drafts).length > 0,
  };
}
