import { describe, expect, it } from 'vitest';
import { reasonChoices } from './adjust-reasons';

describe('reasonChoices (G2)', () => {
  it('bốn chip: Hết hàng, Số lượng quá nhiều, Không mua được, Khác', () => {
    expect(reasonChoices({ ownerLeft: false })).toEqual(['adm_out_of_stock', 'over_quota', 'cannot_buy', 'other']);
  });
  it('chủ phiếu đã nghỉ → thêm "Người đã nghỉ" đứng đầu', () => {
    expect(reasonChoices({ ownerLeft: true })).toEqual(['user_left', 'adm_out_of_stock', 'over_quota', 'cannot_buy', 'other']);
  });
});
