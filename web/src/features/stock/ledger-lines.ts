import type { StockMovement } from './stock.api';

const ZONE = 'Asia/Ho_Chi_Minh';
const DAY_KEY = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: ZONE });
const TIME = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: ZONE });

export interface Receipt {
  kind: 'arrival' | 'makeup';
  ym: string;
  rest: string | null;
}

// Hàng về theo bản in ghi ghi chú máy "Hàng về kỳ 2026-11" / "Về bù kỳ 2026-10 · <ghi chú>"; đọc lại ở web để dòng cũ cũng hiện thành chữ thường
const RECEIPT_NOTES: [Receipt['kind'], RegExp][] = [
  ['arrival', /^Hàng về kỳ (\d{4}-\d{2})(?: · ([\s\S]*))?$/],
  ['makeup', /^Về bù kỳ (\d{4}-\d{2})(?: · ([\s\S]*))?$/],
];

export function receiptOf(note: string | null): Receipt | null {
  for (const [kind, re] of RECEIPT_NOTES) {
    const m = note ? re.exec(note) : null;
    if (m) return { kind, ym: m[1], rest: m[2]?.trim() || null };
  }
  return null;
}

export interface LedgerLine {
  m: StockMovement;
  after: number;
  time: string;
}

export interface LedgerDay {
  key: string;
  // "2026-11-11" theo giờ VN
  day: string;
  lines: LedgerLine[];
}

export const vnDayKey = (d: Date) => DAY_KEY.format(d);

// Sổ đã xếp mới trước; gom các dòng liền nhau cùng ngày VN, giữ tồn sau từng dòng
export function groupByDay(rows: StockMovement[], after: number[]): LedgerDay[] {
  const days: LedgerDay[] = [];
  rows.forEach((m, i) => {
    const at = new Date(m.created_at);
    const day = vnDayKey(at);
    const line = { m, after: after[i], time: TIME.format(at) };
    const last = days[days.length - 1];
    if (last && last.day === day) last.lines.push(line);
    else days.push({ key: `${day}-${m.id}`, day, lines: [line] });
  });
  return days;
}
