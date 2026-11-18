import type { ReviewRow } from '@/features/review/review.api';
import type { DeliveryPerson } from '@/features/delivery/people/delivery-people.api';
import { peopleTabs } from '@/features/delivery/people/people-tabs';
import type { BacklogGroup } from '@/features/delivery/backlog.api';
import { backlogMonths, peopleIn } from '@/features/delivery/backlog-months';
import type { ArrivalsPlan } from '@/features/arrivals/arrivals.api';
import { isShort, toArrivalRows } from '@/features/arrivals/arrival-rows';
import { stockStats, type StockRow } from '@/features/stock/stock-rows';
import { formatVnStamp } from '@/lib/format-time';
import { reviewBadge } from '@/shell/use-admin-badges';

export type TileKey = 'review' | 'ready' | 'arrivals' | 'backlog' | 'period' | 'low' | 'left';
export type TileSource = 'review' | 'people' | 'arrivals' | 'backlog' | 'period' | 'stock';
export type TileTone = 'neutral' | 'ok' | 'warn' | 'danger';
export interface Text {
  key: string;
  params?: Record<string, string | number>;
}
export interface Tile {
  key: TileKey;
  source: TileSource;
  label: Text;
  value: number | string | null;
  hint: Text | null;
  tone: TileTone;
  to: string;
}

type ReviewLite = Pick<ReviewRow, 'line_id' | 'request_id' | 'period_ym' | 'user_sub' | 'created_at'> & Partial<Pick<ReviewRow, 'full_name' | 'custom_name'>>;

export interface TodayData {
  now: Date;
  period?: { ym: string; deadline: string; days_left: number };
  summary?: { registered: number; headcount: number };
  review?: ReviewLite[];
  people?: DeliveryPerson[];
  arrivals?: ArrivalsPlan;
  backlog?: BacklogGroup[];
  stockRows?: StockRow[];
}

const DAY_KEY = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' });
const dayIndex = (at: Date) => Date.parse(`${DAY_KEY.format(at)}T00:00:00Z`) / 86_400_000;

// Đếm theo ngày lịch giờ VN: dòng tạo 23:59 hôm qua đã chờ 1 ngày
export const vnDaysWaiting = (iso: string, now: Date): number => Math.max(0, dayIndex(now) - dayIndex(new Date(iso)));

const monthOf = (ym: string) => Number(ym.slice(5, 7));
const NONE: Text = { key: 'today.tiles.none' };

// Ô việc: có số > 0 thì tô theo mức, bằng 0 thì xanh "Không có việc"
function work(key: Exclude<TileKey, 'period'>, source: TileSource, value: number | null, busy: TileTone, hint: Text | null, to: string): Tile {
  const zero = value === 0;
  return { key, source, label: { key: `today.tiles.${key}.label` }, value, tone: value === null ? 'neutral' : zero ? 'ok' : busy, hint: value === null ? null : zero ? NONE : hint, to };
}

function reviewTile(items: ReviewLite[] | undefined, now: Date): Tile {
  if (!items) return work('review', 'review', null, 'danger', null, '/admin/month');
  const badge = reviewBadge(items);
  const ym = items[0]?.period_ym;
  const oldest = items.filter((r) => r.period_ym === ym).reduce<string | null>((min, r) => (min === null || r.created_at < min ? r.created_at : min), null);
  const hint = ym && oldest ? { key: 'today.tiles.review.hint', params: { month: monthOf(ym), days: vnDaysWaiting(oldest, now) } } : null;
  return work('review', 'review', badge.n, 'danger', hint, badge.link ?? '/admin/month');
}

function arrivalsTile(plan: ArrivalsPlan | undefined): Tile {
  if (!plan) return work('arrivals', 'arrivals', null, 'neutral', null, '/admin/arrivals?short=1');
  const short = plan.snapshot ? toArrivalRows(plan).filter(isShort).length : 0;
  const tile = work('arrivals', 'arrivals', short, 'neutral', plan.snapshot ? { key: 'today.tiles.arrivals.hint', params: { date: formatVnStamp(plan.snapshot.created_at).split(' ')[1] } } : null, '/admin/arrivals?short=1');
  // Chưa gửi NCC thì 0 không có nghĩa "xong việc"
  return plan.snapshot ? tile : { ...tile, tone: 'neutral', hint: { key: 'today.tiles.arrivals.notSent' } };
}

function periodTile(period: TodayData['period'], summary: TodayData['summary']): Tile {
  return {
    key: 'period',
    source: 'period',
    label: period ? { key: 'today.tiles.period.label', params: { month: monthOf(period.ym) } } : { key: 'today.tiles.period.labelPlain' },
    value: period && summary ? `${summary.registered}/${summary.headcount}` : null,
    hint: period ? { key: 'today.tiles.period.hint', params: { deadline: period.deadline, days: period.days_left } } : null,
    tone: 'neutral',
    to: period ? `/admin/month?ym=${period.ym}` : '/admin/month',
  };
}

export function todayTiles(d: TodayData): Tile[] {
  const tabs = d.people ? peopleTabs(d.people) : undefined;
  const months = d.backlog ? backlogMonths(d.backlog, { ym: null, q: '', left: false }) : undefined;
  return [
    reviewTile(d.review, d.now),
    work('ready', 'people', tabs ? tabs.ready.length : null, 'neutral', { key: 'today.tiles.ready.hint' }, '/admin/delivery?tab=ready'),
    arrivalsTile(d.arrivals),
    work('backlog', 'backlog', months ? peopleIn(months) : null, 'neutral', { key: 'today.tiles.backlog.hint', params: { months: months?.length ?? 0 } }, '/admin/backlog'),
    periodTile(d.period, d.summary),
    work('low', 'stock', d.stockRows ? stockStats(d.stockRows).low : null, 'warn', { key: 'today.tiles.low.hint' }, '/admin/stock?filter=low'),
    work('left', 'people', tabs ? tabs.left.length : null, 'warn', { key: 'today.tiles.left.hint' }, '/admin/delivery?tab=left'),
  ];
}

export function todaySummary(tiles: Tile[]): { work: number; urgent: number } {
  const busy = tiles.filter((t) => t.key !== 'period' && typeof t.value === 'number' && t.value > 0);
  return { work: busy.length, urgent: busy.filter((t) => t.tone === 'danger').length };
}

export type AttentionItem =
  | { kind: 'review'; id: string; name: string; what: string; days: number; to: string }
  | { kind: 'left'; id: string; name: string; qty: number; to: string };

const ATTENTION_REVIEW_MAX = 5;

export function attentionItems(d: TodayData): AttentionItem[] {
  const reviews: AttentionItem[] = [...(d.review ?? [])]
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .slice(0, ATTENTION_REVIEW_MAX)
    .map((r) => ({
      kind: 'review',
      id: r.line_id,
      name: r.full_name ?? r.user_sub,
      what: r.custom_name ?? '',
      days: vnDaysWaiting(r.created_at, d.now),
      to: `/admin/month?${new URLSearchParams({ ym: r.period_ym, chip: 'pending', request: r.request_id })}`,
    }));
  const left: AttentionItem[] = (d.people ? peopleTabs(d.people).left : []).map((p) => ({
    kind: 'left',
    id: p.user_sub,
    name: p.full_name ?? p.user_sub,
    qty: p.lines.reduce((n, l) => n + l.remaining_qty, 0),
    to: `/admin/delivery?${new URLSearchParams({ tab: 'left', person: p.user_sub })}`,
  }));
  return [...reviews, ...left];
}
