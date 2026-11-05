import { describe, expect, it } from 'vitest';
import { monthSteps } from './month-steps';

const base = { registered: 39, headcount: 40, isOpen: false, snapshots: 1, needTotal: 0, receipts: 0, pendingDelivery: 0 };
const currentOf = (steps: ReturnType<typeof monthSteps>) => steps.filter((s) => s.current).map((s) => s.key);

describe('monthSteps', () => {
  it('trả đúng 4 bước theo thứ tự Đăng ký → Gửi ADM → Hàng về → Giao, mỗi bước có đường dẫn', () => {
    const steps = monthSteps(base);
    expect(steps.map((s) => [s.key, s.to])).toEqual([
      ['register', '/admin/summary'],
      ['send', '/admin/send-adm'],
      ['arrive', '/admin/arrivals'],
      ['deliver', '/admin/delivery'],
    ]);
  });

  it('kỳ đang mở → bước hiện tại là Đăng ký, chưa bước nào xong', () => {
    const steps = monthSteps({ ...base, isOpen: true, snapshots: 0, needTotal: 5, pendingDelivery: 3 });
    expect(currentOf(steps)).toEqual(['register']);
    expect(steps.map((s) => s.done)).toEqual([false, false, false, false]);
  });

  it('đã khóa, chưa có bản chốt → bước hiện tại là Gửi ADM; Đăng ký xong', () => {
    const steps = monthSteps({ ...base, snapshots: 0, needTotal: 13, pendingDelivery: 4 });
    expect(currentOf(steps)).toEqual(['send']);
    expect(steps[0]!.done).toBe(true);
  });

  it('có bản chốt, cần mua 13 → bước hiện tại là Hàng về; cần mua 0 thì Hàng về xong (hai phía mốc)', () => {
    expect(currentOf(monthSteps({ ...base, needTotal: 13, pendingDelivery: 4 }))).toEqual(['arrive']);
    expect(currentOf(monthSteps({ ...base, needTotal: 1, pendingDelivery: 4 }))).toEqual(['arrive']);
    expect(currentOf(monthSteps({ ...base, needTotal: 0, pendingDelivery: 4 }))).toEqual(['deliver']);
  });

  it('R14: cần mua 5 mà đã có 1 phiếu Hàng về → bước xong, Giao hiện tại; 0 phiếu thì vẫn Hàng về (hai phía mốc)', () => {
    expect(currentOf(monthSteps({ ...base, needTotal: 5, receipts: 0, pendingDelivery: 4 }))).toEqual(['arrive']);
    const steps = monthSteps({ ...base, needTotal: 5, receipts: 1, pendingDelivery: 4 });
    expect(currentOf(steps)).toEqual(['deliver']);
    expect(steps[2]).toMatchObject({ done: true, value: '5' });
  });

  it('cần mua 0, còn 4 dòng chờ giao → Giao hiện tại, 3 bước trước xong', () => {
    const steps = monthSteps({ ...base, pendingDelivery: 4 });
    expect(currentOf(steps)).toEqual(['deliver']);
    expect(steps.map((s) => s.done)).toEqual([true, true, true, false]);
  });

  it('chờ giao 1 → vẫn là bước Giao; chờ giao 0 → xong', () => {
    expect(currentOf(monthSteps({ ...base, pendingDelivery: 1 }))).toEqual(['deliver']);
    expect(currentOf(monthSteps({ ...base, pendingDelivery: 0 }))).toEqual([]);
  });

  it('tất cả xong → không bước nào hiện tại, mọi bước done', () => {
    const steps = monthSteps(base);
    expect(currentOf(steps)).toEqual([]);
    expect(steps.every((s) => s.done)).toBe(true);
  });

  it('giá trị và tiến độ: đăng ký 32/40 → 80%; chưa biết sĩ số → chỉ số đã đăng ký, không thanh', () => {
    const open = monthSteps({ ...base, isOpen: true, registered: 32 });
    expect(open[0]!.value).toBe('32/40');
    expect(open[0]!.progress).toBe(80);
    const unknown = monthSteps({ ...base, isOpen: true, registered: 32, headcount: null });
    expect(unknown[0]!.value).toBe('32');
    expect(unknown[0]!.progress).toBeUndefined();
    expect(monthSteps({ ...base, needTotal: 13 })[2]!.value).toBe('13');
    expect(monthSteps({ ...base, pendingDelivery: 4 })[3]!.value).toBe('4');
  });
});
