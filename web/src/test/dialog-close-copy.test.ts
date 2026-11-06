import { describe, expect, it } from 'vitest';
import en from '@/locales/en';
import vi from '@/locales/vi';

// R-D4.8: nút đóng hộp thoại (không làm gì) luôn là "Quay lại"/"Back"; "Hủy …" chỉ cho hành động thật
type Tree = { [k: string]: string | Tree };
const get = (tree: Tree, path: string): unknown => path.split('.').reduce<unknown>((o, k) => (o as Tree | undefined)?.[k], tree);

// Khóa nhãn nút đóng của các hộp thoại (xác nhận, giao, Hủy nợ, nhóm, Đủ hàng, Làm bản mới, form món/đơn vị/nhóm, dòng ngoài danh mục)
const DIALOG_CLOSE_KEYS = [
  'common.cancel',
  'request.custom.cancel',
  'delivery.confirm.cancel',
  'request.confirm.back',
  'sendAdm.draft.back',
  'sendAdm.sent.confirmBack',
];

describe('Nút đóng hộp thoại là "Quay lại"', () => {
  for (const key of DIALOG_CLOSE_KEYS) {
    it(`${key}: vi "Quay lại", en "Back"`, () => {
      expect(get(vi as unknown as Tree, key), `vi ${key}`).toBe('Quay lại');
      expect(get(en as unknown as Tree, key), `en ${key}`).toBe('Back');
    });
  }

  it('không khóa nút đóng nào là "Hủy"/"Cancel"/"Tiếp tục sửa"/"Keep editing"', () => {
    const banned = /^(Hủy|Cancel|Tiếp tục sửa|Keep editing|Quay lại sửa)$/;
    for (const key of DIALOG_CLOSE_KEYS) {
      expect(String(get(vi as unknown as Tree, key))).not.toMatch(banned);
      expect(String(get(en as unknown as Tree, key))).not.toMatch(banned);
    }
  });

  it('hộp rời trang/bỏ thay đổi giữ lựa chọn "Ở lại" / "Bỏ thay đổi"', () => {
    expect(get(vi as unknown as Tree, 'common.discardKeep')).toBe('Ở lại');
    expect(get(vi as unknown as Tree, 'common.discardOk')).toBe('Bỏ thay đổi');
    expect(get(vi as unknown as Tree, 'sendAdm.leave.stay')).toBe('Ở lại');
    expect(get(vi as unknown as Tree, 'sendAdm.leave.discard')).toBe('Bỏ thay đổi');
    expect(get(en as unknown as Tree, 'sendAdm.leave.stay')).toBe('Stay');
    expect(get(en as unknown as Tree, 'sendAdm.leave.discard')).toBe('Discard changes');
  });

  it('Hủy nợ: nút hành động thật vẫn là "Hủy nợ", nút đóng là "Quay lại"', () => {
    expect(get(vi as unknown as Tree, 'delivery.backlog.cancelDialog.submit')).toBe('Hủy nợ');
    expect(get(vi as unknown as Tree, 'delivery.backlog.cancelDialog.back')).toBe('Quay lại');
  });
});
