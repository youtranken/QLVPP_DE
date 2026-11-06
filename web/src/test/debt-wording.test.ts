import { describe, expect, it } from 'vitest';
import home from '@/locales/vi/home';
import delivery from '@/locales/vi/delivery';

function strings(node: unknown, path = ''): [string, string][] {
  if (typeof node === 'string') return [[path, node]];
  if (node && typeof node === 'object') return Object.entries(node).flatMap(([k, v]) => strings(v, path ? `${path}.${k}` : k));
  return [];
}

// Phần thiếu của tháng đang giao là "Chưa nhận"; chỉ thành nợ khi tháng sau khóa sổ ("không thành nợ" vẫn đúng nghĩa)
const FORBIDDEN = [/(?<!không )thành nợ/i, /vào Còn nợ/i, /chuyển sang Còn nợ/i];

describe('Chữ: phần chưa giao của tháng đang giao không gọi là nợ', () => {
  it('locales vi home + delivery không còn "thành nợ", "vào Còn nợ", "chuyển sang Còn nợ"', () => {
    const hits = [...strings(home), ...strings(delivery)].filter(([, s]) => FORBIDDEN.some((re) => re.test(s)));
    expect(hits).toEqual([]);
  });

  it('các câu đã đổi đúng nguyên văn', () => {
    const all = Object.fromEntries([...strings(home), ...strings(delivery)]);
    expect(all['home.hero.sub.deliver']).toBe(
      'Hàng đã về. Giao cho từng người; phần chưa đủ hàng còn ở Chưa nhận.',
    );
    expect(all['delivery.page.shortToBacklog']).toBe('{{n}} món thiếu kho — phần thiếu còn ở Chưa nhận');
    expect(all['delivery.page.emptyHint']).toBe('Mọi phiếu tháng {{month}} đã giao đủ. Phần thiếu kho còn ở tab Chưa nhận.');
    expect(all['delivery.page.toBacklog']).toBe('Xem Chưa nhận');
    expect(all['delivery.detail.outOfStock']).toBe('Hết hàng — chưa nhận {{n}}');
    expect(all['delivery.detail.shortWarn']).toBe('{{n}} dòng thiếu kho. Giao phần đang có; phần còn lại chờ hàng về.');
    expect(all['delivery.backlog.description']).toBe('Phần chưa giao của các tháng trước tháng {{month}} — giao bổ sung khi có hàng, hoặc hủy nợ.');
    expect(all['delivery.people.description']).toBe('Nhân viên đến lấy: tìm tên, kiểm hàng, bấm Giao.');
  });
});
