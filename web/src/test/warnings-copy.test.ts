import { describe, expect, it } from 'vitest';
import vi from '@/locales/vi/warnings';
import en from '@/locales/en/warnings';

// Chữ bắt buộc của danh mục cảnh báo; biến đặt tên lại cho i18next, chữ giữ từng ký tự
const SPEC: Record<string, string> = {
  W1a: 'Đủ cho người đăng ký',
  W1b: 'Thiếu {{n}} — {{n}} {{unit}} sẽ không có để giao',
  W1c: 'Dư {{n}} vào kho',
  W1d: 'Tủ đã đủ — vẫn dư {{n}} vào kho',
  W2: '{{a}} món thiếu · {{b}} món dư vào kho · {{c}} món đủ',
  W3label: 'Ngừng dùng',
  W3: 'Món đã ngừng — đề nghị mặc định 0; muốn mua thì sửa số',
  W4: 'Không tính {{n}} {{unit}} của người đã nghỉ',
  W5: 'Không tính {{n}} {{unit}} nợ tháng {{m}} — NCC còn nợ giao',
  W6banner: 'Có thay đổi sau bản chốt {{time}} — in lại nếu cần',
  W6step: 'Đã gửi {{time}} · có thay đổi sau đó',
  W7surplus: 'Bản gửi {{x}} · nay cần {{y}} → dư {{n}} vào kho',
  W7short: 'Bản gửi {{x}} · nay cần {{y}} → thiếu {{n}}',
  W8: 'Còn {{n}} món ngoài danh mục chưa duyệt. Chốt bản này sẽ ghi Không mua cho:',
  W8more: '(và {{k}} món nữa)',
  W8deliver: 'Món ngoài danh mục chưa duyệt: {{names}}. Giao sẽ ghi Không mua cho các món này.',
  W9: 'Chưa có món nào để đề nghị',
  W10a: 'Phiếu gửi NCC lúc {{time}} đã có món này ({{n}} {{unit}}) — hàng về sẽ không có người nhận.',
  W10b: 'Phiếu gửi NCC lúc {{time}} chưa có món này. Sau khi chấp nhận, vào Báo cáo & gửi NCC để làm bản mới và in lại, hoặc tự mua riêng.',
  W11: 'Phiếu gửi NCC lúc {{time}} đã tính số cũ — giảm bây giờ thì hàng về dư {{n}} {{unit}} vào kho.',
  W12a: 'Vượt tối đa hiện tại ({{max}})',
  W12b: 'Số lượng tối đa giới hạn {{max}}/tháng. Chốt tháng sẽ tự động tính theo giới hạn',
  W13short: 'Thiếu {{n}} so với bản in',
  W13surplus: 'Dư {{n}} so với bản in — vào kho',
  W14row: 'Đã giảm {{n}} sau khi gửi NCC — phần dư vào tủ',
  W14head: '{{x}} món đã giảm sau khi gửi NCC — phần dư sẽ vào tủ',
  W18: 'Nhập {{x}} món, {{y}} đơn vị vào tủ theo bản in {{time}}.',
  W19row: 'Tủ {{s}} không đủ cho {{k}} người đang chờ {{q}} — thiếu {{short}}',
  W19head: '{{n}} món chưa đủ tủ cho người đang chờ — chờ đợt hàng sau',
  W20short: 'Thiếu {{short}} cho người chờ',
  W20pending: 'Chờ hàng về {{n}}',
  W21: 'Phần này đang giữ cho {{k}} người chờ nhận.',
  W21take: 'Xuất {{q}} sẽ lấy {{x}} {{unit}} đang giữ.',
  W21ok: 'Vẫn xuất',
  W23: 'Phiếu gửi NCC tháng {{m}} đã tính {{n}} {{unit}} này — hủy thì hàng về dư vào kho.',
  W24: 'Món này đang chờ NCC giao {{n}} {{unit}} (bản in {{time}}) — ngừng thì vẫn nhập được hàng đã đặt.',
  W25: '{{n}} người đã nghỉ còn phần chưa nhận: {{names}}',
};

const vars = (s: string) => [...s.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]).sort();

describe('warnings.ts — chữ W1a–W25 đúng bảng R-D17.3', () => {
  it.each(Object.entries(SPEC))('vi %s', (key, text) => {
    expect(vi.warn[key as keyof typeof vi.warn]).toBe(text);
  });

  it('không có khóa thừa ngoài bảng', () => {
    expect(Object.keys(vi.warn).sort()).toEqual(Object.keys(SPEC).sort());
  });

  it.each(Object.entries(SPEC))('en %s có đủ biến như vi', (key, text) => {
    const msg = en.warn[key as keyof typeof en.warn];
    expect(msg.length).toBeGreaterThan(0);
    expect(vars(msg)).toEqual(vars(text));
  });
});
