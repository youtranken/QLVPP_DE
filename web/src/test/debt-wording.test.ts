import { describe, expect, it } from 'vitest';
import month from '@/locales/vi/month';
import delivery from '@/locales/vi/delivery';
import monthEn from '@/locales/en/month';
import deliveryEn from '@/locales/en/delivery';

function strings(node: unknown, path = ''): [string, string][] {
  if (typeof node === 'string') return [[path, node]];
  if (node && typeof node === 'object') return Object.entries(node).flatMap(([k, v]) => strings(v, path ? `${path}.${k}` : k));
  return [];
}

// Phần thiếu của tháng đang giao là "Chưa nhận"; chỉ thành nợ khi tháng sau khóa sổ ("không thành nợ" vẫn đúng nghĩa)
const FORBIDDEN = [/(?<!không )thành nợ/i, /vào Còn nợ/i, /chuyển sang Còn nợ/i];

describe('Chữ: phần chưa giao của tháng đang giao không gọi là nợ', () => {
  it('locales vi month + delivery không còn "thành nợ", "vào Còn nợ", "chuyển sang Còn nợ"', () => {
    const hits = [...strings(month), ...strings(delivery)].filter(([, s]) => FORBIDDEN.some((re) => re.test(s)));
    expect(hits).toEqual([]);
  });

  it('các câu đã đổi đúng nguyên văn', () => {
    const all = Object.fromEntries([...strings(month), ...strings(delivery)]);
    expect(all['delivery.page.shortToBacklog']).toBe('{{n}} món thiếu kho — phần thiếu còn ở Chưa nhận');
    expect(all['delivery.page.emptyHint']).toBe('Mọi phiếu tháng {{month}} đã giao đủ. Phần thiếu kho còn ở tab Chưa nhận.');
    expect(all['delivery.page.toBacklog']).toBe('Xem Chưa nhận');
    expect(all['delivery.detail.outOfStock']).toBe('Hết hàng — chưa nhận {{n}}');
    expect(all['delivery.detail.shortWarn']).toBe('{{n}} dòng thiếu kho. Giao phần đang có; phần còn lại chờ hàng về.');
  });

  it('en: một thuật ngữ cho Chưa nhận là "Not yet received", không còn "Not collected"/"not-yet-collected"', () => {
    const hits = [...strings(monthEn), ...strings(deliveryEn)].filter(([, s]) => /not(-| )collected|not-yet-collected/i.test(s));
    expect(hits).toEqual([]);
    const all = Object.fromEntries(strings(deliveryEn));
    expect(all['delivery.people.tabs.pending']).toBe('Not yet received');
    expect(all['delivery.people.status.pending']).toBe('Not yet received');
  });

  it('en theo bảng chữ của spec (Hủy nợ, Tủ còn, NOT_DEBT_YET)', () => {
    const all = Object.fromEntries(strings(deliveryEn));
    expect(all['delivery.backlog.cancelDialog.title']).toBe('Write off <hl>{{n}} {{unit}} {{name}}</hl> for {{person}}?');
    expect(all['delivery.backlog.cols.stock']).toBe('In stock');
    expect(all['delivery.backlog.stock']).toBe('In stock {{n}}');
    expect(all['delivery.backlog.cancelDialog.block.NOT_DEBT_YET']).toBe('This is still pending for the current month — reduce it in Summary instead.');
    expect(all['delivery.backlog.cancelDialog.seen']).toBe('The employee will see the reason in History.');
  });
});
