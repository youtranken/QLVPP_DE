import type { TFunction } from 'i18next';
import { adjustReasonText } from '@/lib/adjust-reason';

interface BellLine {
  kind?: string;
  name?: unknown;
  name_en?: unknown;
  unit?: unknown;
  before?: unknown;
  after?: unknown;
  qty?: unknown;
  reason_code?: unknown;
  reason_note?: unknown;
}

const str = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v));
const YM = /^\d{4}-(0[1-9]|1[0-2])$/;

function monthOf(ym: string, lang: string): string {
  const month = Number(ym.slice(5, 7));
  if (lang !== 'en') return String(month);
  return new Intl.DateTimeFormat('en-GB', { month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(2000, month - 1, 1)));
}

// Chuông ngày gộp dòng Hành chính giảm/bỏ với dòng hủy vì ADM hết hàng; server chỉ gửi ≤ 5 dòng đầu + more
export function lineAdjustedText(
  p: Record<string, unknown>,
  t: TFunction,
  lang: string,
  unitName: (code: string) => string,
): string {
  const lines = Array.isArray(p.lines) ? (p.lines as BellLine[]) : [];
  if (lines.length === 0 || !YM.test(str(p.ym))) return t('notifications.fallback.line_adjusted');
  const more = Number(p.more) > 0 ? Number(p.more) : 0;
  const month = monthOf(str(p.ym), lang);
  const named = (l: BellLine) => ({
    name: str(lang === 'en' && l.name_en ? l.name_en : l.name),
    unit: l.unit ? unitName(str(l.unit)) : '',
  });
  const cuts = lines.filter((l) => l.kind !== 'adm_out');
  const parts: string[] = [];
  if (cuts.length === 1 && more === 0) {
    const l = cuts[0];
    const key = Number(l.after) === 0 ? 'removed' : 'one';
    const reason = adjustReasonText(t, str(l.reason_code), str(l.reason_note));
    parts.push(t(`notifications.topics.line_adjusted.${key}`, { ...named(l), before: str(l.before), after: str(l.after), month, reason }));
  } else if (cuts.length > 0) {
    parts.push(t('notifications.topics.line_adjusted.many', { n: cuts.length + more, month }));
  }
  for (const l of lines.filter((x) => x.kind === 'adm_out')) {
    parts.push(t('notifications.topics.line_adjusted.admOut', { ...named(l), qty: str(l.qty) }));
  }
  if (cuts.length === 0 && more > 0) parts.push(t('notifications.topics.line_adjusted.more', { n: more }));
  return parts.join(' ');
}
