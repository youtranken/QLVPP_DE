import { matchesSearch } from '@/features/request/request-format';
import type { DeliveryPerson } from './delivery-people.api';
import { bulkPlan } from './bulk-plan';

export const PEOPLE_TABS = ['pending', 'ready', 'partial', 'done', 'left'] as const;
export type PeopleTab = (typeof PEOPLE_TABS)[number];

export const parsePeopleTab = (raw: string | null): PeopleTab => PEOPLE_TABS.find((x) => x === raw) ?? 'pending';

// Chưa nhận gồm cả người chỉ còn nợ kỳ trước: mọi người còn phần phải nhận, để "Giao được ngay"/"Giao một phần" là tập con của nó.
// Giao được ngay/một phần theo đúng số hộp giao nhiều phiếu sẽ đưa (ưu tiên đăng ký trước, người đã nghỉ gợi ý 0)
export function peopleTabs(people: DeliveryPerson[]): Record<PeopleTab, DeliveryPerson[]> {
  const leftBySub = new Map(bulkPlan(people, people).summary.map((s) => [s.user_sub, s.left]));
  const owing = people.filter((p) => p.status !== 'done');
  return {
    pending: owing,
    ready: owing.filter((p) => leftBySub.get(p.user_sub) === 0),
    partial: owing.filter((p) => (leftBySub.get(p.user_sub) ?? 0) > 0),
    done: people.filter((p) => p.status === 'done'),
    left: owing.filter((p) => p.user_status !== 'active'),
  };
}

// Có từ khóa thì tìm trên mọi trạng thái: người đứng trước quầy cần thấy ngay dù đã nhận
export function listPeople(people: DeliveryPerson[], tabs: Record<PeopleTab, DeliveryPerson[]>, tab: PeopleTab, q: string): DeliveryPerson[] {
  if (q.trim()) return people.filter((p) => matchesSearch(`${p.full_name ?? ''} ${p.department ?? ''}`, q));
  return tabs[tab];
}
