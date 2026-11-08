import type { TFunction } from 'i18next';
import { formatVnStamp } from '@/lib/format-time';

export type StepKey = 'register' | 'send' | 'arrive' | 'deliver';

export interface StepState {
  key: StepKey;
  done: boolean;
  current: boolean;
  value: string;
  to: string;
}

export interface SendInput {
  state: 'unsent' | 'no_order' | 'sent';
  at: string | null;
}

export interface PlanInput {
  rows: { remaining: number; adm_out: boolean }[];
  custom: { remaining: number; adm_out: boolean }[];
}

export interface MonthStepsInput {
  registered: number;
  headcount: number | null;
  isOpen: boolean;
  send: SendInput | null;
  plan: PlanInput | null;
  // Phiếu có gì để giao: xong khi giao + hủy nợ đủ số đăng ký
  deliver: { done: number; total: number } | null;
  ym: string;
}

// Hàng ADM hết hàng không chờ về nữa nên tính là xong; món ngừng đã đặt vẫn chờ
export function arrivalProgress(plan: PlanInput): { done: number; total: number } {
  const all = [...plan.rows, ...plan.custom];
  return { done: all.filter((r) => r.remaining === 0 || r.adm_out).length, total: all.length };
}

function sendValue(send: SendInput | null, t: TFunction): { done: boolean; value: string } {
  if (send?.state === 'sent') return { done: true, value: send.at ? formatVnStamp(send.at) : t('month.value.sent') };
  if (send?.state === 'no_order') return { done: true, value: t('month.value.noOrder') };
  return { done: false, value: t('month.value.sendTodo') };
}

function arriveValue(send: SendInput | null, plan: PlanInput | null, t: TFunction): { done: boolean; value: string } {
  if (send?.state === 'no_order') return { done: true, value: t('month.value.noOrderArrive') };
  if (!plan) return { done: false, value: t('month.value.none') };
  const { done, total } = arrivalProgress(plan);
  return { done: send?.state === 'sent' && done === total, value: t('month.value.arrive', { done, total }) };
}

// Bước hiện tại = bước đầu tiên chưa xong; tất cả xong thì không có bước nào hiện tại
export function monthSteps(i: MonthStepsInput, t: TFunction): StepState[] {
  const known = i.headcount !== null && i.headcount > 0;
  const deliver = i.deliver ?? { done: 0, total: 0 };
  const steps: Omit<StepState, 'current'>[] = [
    { key: 'register', done: !i.isOpen, value: known ? `${i.registered}/${i.headcount}` : String(i.registered), to: `/admin/month?ym=${i.ym}` },
    { key: 'send', to: '/admin/reports', ...sendValue(i.send, t) },
    { key: 'arrive', to: '/admin/arrivals', ...arriveValue(i.send, i.plan, t) },
    { key: 'deliver', done: deliver.done === deliver.total, value: t('month.value.deliver', deliver), to: '/admin/delivery' },
  ];
  const first = steps.findIndex((s) => !s.done);
  return steps.map((s, idx) => ({ ...s, current: idx === first }));
}
