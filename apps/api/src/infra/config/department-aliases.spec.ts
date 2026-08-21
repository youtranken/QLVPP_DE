import { describe, expect, it } from 'vitest';
import { parseEnv } from './env';

/**
 * `VPP_DEPARTMENT_ALIASES` tồn tại vì claim `department` của PMH ID là chuỗi tự do
 * do IdP quyết định, mà chuỗi đó hiện thẳng cho người dùng ở màn duyệt đơn và báo
 * cáo Excel. Thực tế đo được 21/08/2026: PMH ID trả `Dept_Test_VPP`.
 */
function aliases(raw: string) {
  return parseEnv({ VPP_DEPARTMENT_ALIASES: raw } as NodeJS.ProcessEnv).VPP_DEPARTMENT_ALIASES;
}

describe('VPP_DEPARTMENT_ALIASES', () => {
  it('bỏ trống ⇒ không ánh xạ gì', () => {
    expect(aliases('')).toEqual({});
  });

  it('một cặp nguồn=đích', () => {
    expect(aliases('Dept_Test_VPP=Hành chính')).toEqual({ Dept_Test_VPP: 'Hành chính' });
  });

  it('nhiều cặp, cắt khoảng trắng thừa', () => {
    expect(aliases(' Dept_KT = Kỹ thuật , Dept_KD=Kinh doanh ')).toEqual({
      Dept_KT: 'Kỹ thuật',
      Dept_KD: 'Kinh doanh',
    });
  });

  it('đích rỗng ⇒ giữ khoá với giá trị rỗng (nghĩa là BỎ phòng ban đó)', () => {
    expect(aliases('Dept_Test_VPP=')).toEqual({ Dept_Test_VPP: '' });
  });

  it('tách ở dấu = ĐẦU TIÊN, tên đích chứa dấu = vẫn nguyên', () => {
    expect(aliases('Dept_X=Phòng A=B')).toEqual({ Dept_X: 'Phòng A=B' });
  });

  it('mẩu không có dấu = thì bỏ qua, không làm hỏng cặp khác', () => {
    expect(aliases('rác,Dept_KT=Kỹ thuật')).toEqual({ Dept_KT: 'Kỹ thuật' });
  });
});
