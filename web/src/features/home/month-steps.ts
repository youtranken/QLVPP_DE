import type { TFunction } from 'i18next';
import { formatVnStamp } from '@/lib/format-time';

export type StepKey = 'register' | 'send' | 'arrive' | 'deliver';

export interface StepState {
  key: StepKey;
  done: boolean;
  current: boolean;
  value: string;
  progress?: number;
  to: string;
  changed?: boolean;
  note?: string;
  link?: { to: string; label: string };
  // Chữ riêng cho nút đi thẳng (kỳ còn mở: "Xem đăng ký kỳ tháng N"); không có thì dùng chữ chung của bước
  cta?: string;
}

export interface SendInput {
  state: 'unsent' | 'no_order' | 'sent';
  at: string | null;
  items: number;
  units: number;
  changed: boolean;
}

export interface PlanInput {
  snapshot: { id: string } | null;
  rows: { remaining: number; adm_out: boolean }[];
  custom: { remaining: number; adm_out: boolean }[];
}

export interface MonthStepsInput {
  registered: number;
  headcount: number | null;
  isOpen: boolean;
  send: SendInput | null;
  plan: PlanInput | null;
  pendingDelivery: number;
  // Kỳ của thẻ này; kỳ còn mở thì Tổng hợp chỉ xem danh sách đăng ký
  ym: string;
}

const SEND_ADM = '/admin/send-adm';

// Hàng ADM hết hàng không chờ về nữa; món ngừng đã đặt vẫn chờ
function outstanding(plan: PlanInput | null): number {
  if (!plan) return 0;
  const rows = plan.rows.filter((r) => !r.adm_out).reduce((n, r) => n + r.remaining, 0);
  return rows + plan.custom.filter((c) => !c.adm_out).reduce((n, c) => n + c.remaining, 0);
}

function sendStep(send: SendInput | null, t: TFunction) {
  const time = send?.at ? formatVnStamp(send.at) : '';
  if (send?.state === 'sent') {
    const value = send.changed ? t('warn.W6step', { time }) : t('home.value.sent', { time, x: send.items, y: send.units });
    return { done: true, value, changed: send.changed, note: '', link: { to: SEND_ADM, label: t('home.link.viewSent') } };
  }
  if (send?.state === 'no_order') return { done: true, value: t('home.value.noOrder', { time }), changed: false, note: '' };
  return { done: false, value: t('home.value.sendTodo'), changed: false, note: t('home.note.sendTodo') };
}

function arriveStep(send: SendInput | null, plan: PlanInput | null, t: TFunction) {
  if (send?.state === 'no_order') return { done: true, value: t('home.value.noOrderArrive'), note: '' };
  const left = outstanding(plan);
  const done = send?.state === 'sent' && !!plan?.snapshot && left === 0;
  return done ? { done, value: t('home.value.arriveDone'), note: t('home.note.arriveDone') } : { done, value: String(left), note: t('home.note.arriveTodo') };
}

// Bước hiện tại = bước đầu tiên chưa xong; tất cả xong thì không có bước nào hiện tại
export function monthSteps(i: MonthStepsInput, t: TFunction): StepState[] {
  const known = i.headcount !== null && i.headcount > 0;
  const month = Number(i.ym.slice(5, 7));
  const summary = `/admin/summary?ym=${i.ym}`;
  const steps: Omit<StepState, 'current'>[] = [
    {
      key: 'register',
      done: !i.isOpen,
      value: known ? `${i.registered}/${i.headcount}` : String(i.registered),
      progress: known ? Math.min(100, Math.round((i.registered / i.headcount!) * 100)) : undefined,
      to: summary,
      ...(i.isOpen ? { cta: t('home.cta.registerOpen', { month }) } : { link: { to: summary, label: t('home.cta.registerView', { month }) } }),
    },
    { key: 'send', to: SEND_ADM, ...sendStep(i.send, t) },
    { key: 'arrive', to: '/admin/arrivals', ...arriveStep(i.send, i.plan, t) },
    { key: 'deliver', done: i.pendingDelivery === 0, value: String(i.pendingDelivery), to: '/admin/delivery' },
  ];
  const first = steps.findIndex((s) => !s.done);
  return steps.map((s, idx) => ({ ...s, current: idx === first }));
}
