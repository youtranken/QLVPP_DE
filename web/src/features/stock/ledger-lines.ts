import type { StockMovement } from './stock.api';

const ZONE = 'Asia/Ho_Chi_Minh';
const DAY_KEY = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: ZONE });
const TIME = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: ZONE });

export interface Receipt {
  kind: 'arrival' | 'makeup';
  ym: string;
  rest: string | null;
}

// Dòng hàng về nhận ra bằng receipt_ym; ghi chú máy chỉ còn dùng để biết "về bù" và tách phần ghi chú người gõ
const MAKEUP_NOTE = /^Về bù kỳ /;
const MACHINE_PREFIX = /^(?:Hàng về kỳ|Về bù kỳ) \d{4}-\d{2}(?: · )?/;

export function receiptOf(m: Pick<StockMovement, 'receipt_ym' | 'note'>): Receipt | null {
  if (!m.receipt_ym) return null;
  const note = m.note ?? '';
  return { kind: MAKEUP_NOTE.test(note) ? 'makeup' : 'arrival', ym: m.receipt_ym, rest: note.replace(MACHINE_PREFIX, '').trim() || null };
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
