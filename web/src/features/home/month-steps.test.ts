import { describe, expect, it } from 'vitest';
import i18n from '@/lib/i18n';
import { monthSteps, type MonthStepsInput, type PlanInput, type SendInput } from './month-steps';

// 22:12 05/11 giờ VN
const SENT_AT = '2026-11-05T15:12:00Z';
const sent: SendInput = { state: 'sent', at: SENT_AT, items: 11, units: 78, changed: false };
const unsent: SendInput = { state: 'unsent', at: null, items: 0, units: 0, changed: false };
const plan = (rows: { remaining: number; adm_out?: boolean; usable?: boolean }[], custom: { remaining: number; adm_out?: boolean }[] = [], snapshot: PlanInput['snapshot'] = { id: 's1' }): PlanInput => ({
  snapshot,
  rows: rows.map((r) => ({ adm_out: false, usable: true, ...r })),
  custom: custom.map((c) => ({ adm_out: false, ...c })),
});
const base: MonthStepsInput = { registered: 39, headcount: 40, isOpen: false, send: sent, plan: plan([{ remaining: 0 }]), pendingDelivery: 0 };
const steps = (o: Partial<MonthStepsInput> = {}) => monthSteps({ ...base, ...o }, i18n.t);
const currentOf = (s: ReturnType<typeof monthSteps>) => s.filter((x) => x.current).map((x) => x.key);
const step = (o: Partial<MonthStepsInput>, key: string) => steps(o).find((s) => s.key === key)!;

describe('monthSteps', () => {
  it('trả đúng 4 bước theo thứ tự Đăng ký → Gửi ADM → Hàng về → Giao, mỗi bước có đường dẫn', () => {
    expect(steps().map((s) => [s.key, s.to])).toEqual([
      ['register', '/admin/summary'],
      ['send', '/admin/send-adm'],
      ['arrive', '/admin/arrivals'],
      ['deliver', '/admin/delivery'],
    ]);
  });

  it('kỳ đang mở → bước hiện tại là Đăng ký, chưa bước nào xong', () => {
    const s = steps({ isOpen: true, send: null, plan: null, pendingDelivery: 3 });
    expect(currentOf(s)).toEqual(['register']);
    expect(s.map((x) => x.done)).toEqual([false, false, false, false]);
  });

  it('bản có hàng 22:12 05/11 (11 món, 78 đơn vị) → Gửi ADM xong, "Đã gửi 22:12 05/11 · 11 món, 78 đơn vị", liên kết "Xem bản đã gửi"', () => {
    const s = step({}, 'send');
    expect(s).toMatchObject({ done: true, changed: false, value: 'Đã gửi 22:12 05/11 · 11 món, 78 đơn vị' });
    expect(s.link).toEqual({ to: '/admin/send-adm', label: 'Xem bản đã gửi' });
  });

  it('chỉ có bản rỗng (server: chưa gửi) → Gửi ADM chưa xong, là bước hiện tại, không liên kết bản đã gửi', () => {
    const s = steps({ send: unsent, plan: plan([{ remaining: 13 }], [], null), pendingDelivery: 4 });
    expect(currentOf(s)).toEqual(['send']);
    expect(s[1]).toMatchObject({ done: false, value: 'Chưa gửi' });
    expect(s[1]!.link).toBeUndefined();
  });

  it('có thay đổi sau bản → "Đã gửi 09:02 12/12 · có thay đổi sau đó", changed = true, vẫn xong', () => {
    const s = step({ send: { ...sent, at: '2026-12-12T02:02:00Z', changed: true } }, 'send');
    expect(s).toMatchObject({ done: true, changed: true, value: 'Đã gửi 09:02 12/12 · có thay đổi sau đó' });
  });

  it('no_order → Gửi ADM "Không cần đề nghị ADM · 10:15 11/11" và Hàng về "Không có đơn gửi ADM", cả hai xong', () => {
    const s = steps({ send: { ...unsent, state: 'no_order', at: '2026-11-11T03:15:00Z' }, plan: null, pendingDelivery: 2 });
    expect(s[1]).toMatchObject({ done: true, value: 'Không cần đề nghị ADM · 10:15 11/11' });
    expect(s[2]).toMatchObject({ done: true, value: 'Không có đơn gửi ADM' });
    expect(currentOf(s)).toEqual(['deliver']);
  });

  it('1 đợt về nhưng còn remaining 2 → Hàng về chưa xong, giá trị 2; remaining 0 → xong "Đủ hàng" (hai phía mốc)', () => {
    expect(step({ plan: plan([{ remaining: 2 }, { remaining: 0 }]) }, 'arrive')).toMatchObject({ done: false, value: '2' });
    expect(currentOf(steps({ plan: plan([{ remaining: 1 }]), pendingDelivery: 4 }))).toEqual(['arrive']);
    expect(step({ plan: plan([{ remaining: 0 }, { remaining: 0 }]) }, 'arrive')).toMatchObject({ done: true, value: 'Đủ hàng' });
  });

  it('giá trị Hàng về = tổng remaining; hàng ADM hết hàng bị bỏ qua; món đã ngừng đã đặt còn 2 vẫn chờ về; ngoài DM còn remaining vẫn tính', () => {
    expect(step({ plan: plan([{ remaining: 3 }, { remaining: 4 }]) }, 'arrive').value).toBe('7');
    expect(step({ plan: plan([{ remaining: 0 }, { remaining: 5, adm_out: true }]) }, 'arrive').done).toBe(true);
    expect(step({ plan: plan([{ remaining: 0 }, { remaining: 2, usable: false }]) }, 'arrive')).toMatchObject({ done: false, value: '2' });
    expect(step({ plan: plan([{ remaining: 0 }], [{ remaining: 1 }]) }, 'arrive')).toMatchObject({ done: false, value: '1' });
    expect(step({ plan: plan([{ remaining: 0 }], [{ remaining: 1, adm_out: true }]) }, 'arrive').done).toBe(true);
  });

  it('chưa có bản có hàng → Hàng về chưa xong dù mọi remaining 0 (kế hoạch theo số gộp)', () => {
    expect(step({ send: unsent, plan: plan([{ remaining: 0 }], [], null) }, 'arrive').done).toBe(false);
  });

  it('chờ giao 1 → vẫn là bước Giao; chờ giao 0 → xong, không bước nào hiện tại', () => {
    expect(currentOf(steps({ pendingDelivery: 1 }))).toEqual(['deliver']);
    const all = steps({ pendingDelivery: 0 });
    expect(currentOf(all)).toEqual([]);
    expect(all.every((s) => s.done)).toBe(true);
  });

  it('giá trị và tiến độ: đăng ký 32/40 → 80%; chưa biết sĩ số → chỉ số đã đăng ký, không thanh; chờ giao 4 → "4"', () => {
    const open = steps({ isOpen: true, registered: 32, send: null, plan: null });
    expect(open[0]!.value).toBe('32/40');
    expect(open[0]!.progress).toBe(80);
    const unknown = steps({ isOpen: true, registered: 32, headcount: null, send: null, plan: null });
    expect(unknown[0]!.value).toBe('32');
    expect(unknown[0]!.progress).toBeUndefined();
    expect(steps({ pendingDelivery: 4 })[3]!.value).toBe('4');
  });
});
