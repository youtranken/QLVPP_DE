export type StepKey = 'register' | 'send' | 'arrive' | 'deliver';

export interface StepState {
  key: StepKey;
  done: boolean;
  current: boolean;
  value: string;
  progress?: number;
  to: string;
}

export interface MonthStepsInput {
  registered: number;
  headcount: number | null;
  isOpen: boolean;
  snapshots: number;
  needTotal: number;
  pendingDelivery: number;
}

// Bước hiện tại = bước đầu tiên chưa xong; tất cả xong thì không có bước nào hiện tại
export function monthSteps(i: MonthStepsInput): StepState[] {
  const known = i.headcount !== null && i.headcount > 0;
  const steps: Omit<StepState, 'current'>[] = [
    {
      key: 'register',
      done: !i.isOpen,
      value: known ? `${i.registered}/${i.headcount}` : String(i.registered),
      progress: known ? Math.min(100, Math.round((i.registered / i.headcount!) * 100)) : undefined,
      to: '/admin/summary',
    },
    { key: 'send', done: i.snapshots > 0, value: String(i.snapshots), to: '/admin/send-adm' },
    { key: 'arrive', done: i.needTotal === 0, value: String(i.needTotal), to: '/admin/arrivals' },
    { key: 'deliver', done: i.pendingDelivery === 0, value: String(i.pendingDelivery), to: '/admin/delivery' },
  ];
  const first = steps.findIndex((s) => !s.done);
  return steps.map((s, idx) => ({ ...s, current: idx === first }));
}
