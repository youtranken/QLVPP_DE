import type { TFunction } from 'i18next';
import type { NotificationView } from './notifications.api';

const ZONE = 'Asia/Ho_Chi_Minh';
const TOPICS = new Set([
  'period_open',
  'reminder',
  'period_locked',
  'low_stock',
  'request_delivered',
  'line_cancelled',
  'custom_line_new',
]);

const str = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v));

function monthLabel(ym: string, t: TFunction, lang: string): string {
  const month = Number(ym.slice(5, 7));
  if (lang !== 'en') return t('notifications.month', { month });
  return new Intl.DateTimeFormat('en-GB', { month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(2000, month - 1, 1)));
}

// Hạn là mốc 00:00 ngày sau ngày cuối → lùi 1 ms để ra đúng ngày cuối theo giờ VN
function lastDay(deadline: string): string {
  const parts = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: '2-digit', timeZone: ZONE }).formatToParts(
    new Date(new Date(deadline).getTime() - 1),
  );
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${part('day')}/${part('month')}`;
}

const pick = (lang: string, vi: unknown, en: unknown): string => str(lang === 'en' && en ? en : vi);

export function notificationText(
  n: NotificationView,
  t: TFunction,
  lang: string,
  unitName: (code: string) => string,
): string {
  if (!TOPICS.has(n.topic) && n.topic !== 'line_review') return t('notifications.topics.unknown');
  const p = n.params;
  const base = {
    month: monthLabel(str(p.ym), t, lang),
    deadline: p.deadline ? lastDay(str(p.deadline)) : '',
    registered: str(p.registered),
    headcount: str(p.headcount),
    name: n.topic === 'line_review' || n.topic === 'custom_line_new' ? str(p.name) : pick(lang, p.name, p.name_en),
    stock_qty: str(p.stock_qty),
    qty: str(p.qty),
    unit: p.unit ? unitName(str(p.unit)) : '',
    reason: str(p.reason),
    person: str(p.person) || t('notifications.someone'),
    item: pick(lang, p.item_name, p.item_name_en),
    note: str(p.note),
  };
  if (n.topic !== 'line_review') return t(`notifications.topics.${n.topic}`, base);
  const action = str(p.action);
  const withNote = base.note && (action === 'accepted' || action === 'rejected') ? `${action}Note` : action;
  if (!['accepted', 'converted', 'rejected'].includes(action)) return t('notifications.topics.unknown');
  return t(`notifications.topics.line_review.${withNote}`, base);
}
