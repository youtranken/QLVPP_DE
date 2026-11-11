import type { TFunction } from 'i18next';
import { reviewReasonText } from '@/lib/review-note';
import { leftWorkText } from './left-work-text';
import { lineAdjustedText } from './line-adjusted-text';
import type { NotificationView } from './notifications.api';

const ZONE = 'Asia/Ho_Chi_Minh';
// Thiếu tham số bắt buộc thì dùng câu dự phòng của topic thay vì câu gãy
const REQUIRED: Record<string, string[]> = {
  period_open: ['ym', 'deadline'],
  reminder: ['ym', 'deadline'],
  period_locked: ['ym', 'registered', 'headcount'],
  low_stock: ['name', 'stock_qty'],
  request_delivered: ['ym'],
  line_cancelled: ['ym', 'name', 'qty'],
  custom_line_new: ['ym', 'name'],
  line_review: ['ym', 'name'],
};
const YM = /^\d{4}-(0[1-9]|1[0-2])$/;

const present = (v: unknown) => v != null && v !== '';
function complete(topic: string, p: Record<string, unknown>): boolean {
  const keys = [...REQUIRED[topic], ...(topic === 'line_review' && p.action === 'converted' ? ['item_name'] : [])];
  return keys.every((k) => present(p[k])) && (!('ym' in p) || YM.test(str(p.ym)));
}

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
  if (n.topic === 'line_adjusted') return lineAdjustedText(n.params, t, lang, unitName);
  if (n.topic === 'user_left_with_work') return leftWorkText(n.params, t);
  if (!(n.topic in REQUIRED)) return t('notifications.topics.unknown');
  const p = n.params;
  if (!complete(n.topic, p)) return t(`notifications.fallback.${n.topic}`);
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
    // Lý do app tự ghi đi bằng mã để dịch theo ngôn ngữ người đọc
    note: p.note_code ? (reviewReasonText(str(p.note_code), t) ?? '') : str(p.note),
  };
  if (n.topic === 'period_locked' && Number(p.custom_pending) > 0) {
    return t('notifications.topics.period_lockedCustom', { ...base, custom: str(p.custom_pending) });
  }
  if (n.topic === 'line_cancelled' && !base.reason) return t('notifications.topics.line_cancelledNoReason', base);
  if (n.topic !== 'line_review') return t(`notifications.topics.${n.topic}`, base);
  const action = str(p.action);
  const withNote = base.note && (action === 'accepted' || action === 'rejected') ? `${action}Note` : action;
  if (!['accepted', 'converted', 'rejected'].includes(action)) return t('notifications.topics.unknown');
  return t(`notifications.topics.line_review.${withNote}`, base);
}
