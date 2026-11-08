import { describe, expect, it } from 'vitest';
import i18n from '@/lib/i18n';
import { arrivalProgress, monthSteps, type MonthStepsInput, type PlanInput, type SendInput } from './month-steps';

// 11:50 08/11 giờ VN
const SENT_AT = '2026-11-08T04:50:00Z';
const sent: SendInput = { state: 'sent', at: SENT_AT };
const unsent: SendInput = { state: 'unsent', at: null };
const plan = (rows: { remaining: number; adm_out?: boolean }[], custom: { remaining: number; adm_out?: boolean }[] = []): PlanInput => ({
  rows: rows.map((r) => ({ adm_out: false, ...r })),
  custom: custom.map((c) => ({ adm_out: false, ...c })),
});
const base: MonthStepsInput = { registered: 4, headcount: 5, isOpen: false, send: sent, plan: plan([{ remaining: 0 }]), deliver: { done: 4, total: 4 }, ym: '2026-11' };
const steps = (o: Partial<MonthStepsInput> = {}) => monthSteps({ ...base, ...o }, i18n.t);
const step = (o: Partial<MonthStepsInput>, key: string) => steps(o).find((s) => s.key === key)!;
const currentOf = (s: ReturnType<typeof monthSteps>) => s.filter((x) => x.current).map((x) => x.key);

describe('monthSteps (dải gọn của Kỳ tháng)', () => {
  it('đúng 4 bước theo thứ tự, mỗi bước là link sang trang của nó', () => {
    expect(steps().map((s) => [s.key, s.to])).toEqual([
      ['register', '/admin/month?ym=2026-11'],
      ['send', '/admin/reports'],
      ['arrive', '/admin/arrivals'],
      ['deliver', '/admin/delivery'],
    ]);
  });

  it('kỳ khóa: Đăng ký "4/5", Gửi ADM "11:50 08/11", Hàng về "19/21 món", Giao "0/4 phiếu"', () => {
    const rows = [...Array(19).fill({ remaining: 0 }), { remaining: 3 }, { remaining: 1 }];
    const s = steps({ plan: plan(rows), deliver: { done: 0, total: 4 } });
    expect(s.map((x) => x.value)).toEqual(['4/5', '11:50 08/11', '19/21 món', '0/4 phiếu']);
    expect(currentOf(s)).toEqual(['arrive']);
  });

  it('kỳ đang mở: chưa bước nào xong, bước hiện tại là Đăng ký', () => {
    const s = steps({ isOpen: true, send: null, plan: null, deliver: null });
    expect(s.map((x) => x.done)).toEqual([false, false, false, true]);
    expect(currentOf(s)).toEqual(['register']);
  });

  it('chưa gửi → Gửi ADM "Chưa gửi" là bước hiện tại; Hàng về chưa có kế hoạch ghi "—"', () => {
    const s = steps({ send: unsent, plan: null, deliver: { done: 0, total: 4 } });
    expect(currentOf(s)).toEqual(['send']);
    expect(s[1]!.value).toBe('Chưa gửi');
    expect(s[2]!.value).toBe('—');
  });

  it('không cần đề nghị → Gửi ADM và Hàng về cùng xong', () => {
    const s = steps({ send: { state: 'no_order', at: SENT_AT }, plan: null });
    expect(s[1]).toMatchObject({ done: true, value: 'Không cần đề nghị' });
    expect(s[2]).toMatchObject({ done: true, value: 'Không có đơn gửi ADM' });
  });

  it('ranh Hàng về: còn thiếu 1 món → chưa xong; hết sạch → xong', () => {
    expect(step({ plan: plan([{ remaining: 0 }, { remaining: 1 }]) }, 'arrive').done).toBe(false);
    expect(step({ plan: plan([{ remaining: 0 }, { remaining: 0 }]) }, 'arrive').done).toBe(true);
  });

  it('ranh Giao: 3/4 phiếu chưa xong, 4/4 xong; không có phiếu nào cần giao (0/0) coi là xong', () => {
    expect(step({ deliver: { done: 3, total: 4 } }, 'deliver').done).toBe(false);
    expect(step({ deliver: { done: 4, total: 4 } }, 'deliver').done).toBe(true);
    expect(step({ deliver: { done: 0, total: 0 } }, 'deliver').value).toBe('0/0 phiếu');
  });

  it('tất cả xong thì không bước nào là hiện tại', () => {
    expect(currentOf(steps())).toEqual([]);
  });

  it('không biết headcount → chỉ số đã đăng ký', () => {
    expect(step({ headcount: null, registered: 7 }, 'register').value).toBe('7');
  });
});

describe('arrivalProgress', () => {
  it('ADM hết hàng tính là xong; món ngoài DM đếm chung', () => {
    expect(arrivalProgress(plan([{ remaining: 2, adm_out: true }, { remaining: 2 }], [{ remaining: 0 }]))).toEqual({ done: 2, total: 3 });
  });
});
