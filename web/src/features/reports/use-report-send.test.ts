import { describe, expect, it } from 'vitest';
import { itemRow, sendReport, sentData, sentState } from '@/features/send-adm/send-adm-fixtures';
import { changedKeys } from './use-report-send';

// Bản gửi NCC: Bút cần 5 (đặt 5), Giấy cần 3 (đặt 3), Kẹp cần 2 (tủ đủ, đặt 0)
const SENT_REPORT = sendReport([itemRow({ key: 'kA', requested: 5, need: 5 }), itemRow({ key: 'kB', requested: 3, need: 3 }), itemRow({ key: 'kC', requested: 2, need: 0 })]);
const SENT = sentState(sentData(SENT_REPORT, { kA: 5, kB: 3, kC: 0 })).sent;

describe('changedKeys — món "đổi sau bản này"', () => {
  it('nhận rồi giao hết hàng kỳ này sau khi gửi: món rời báo cáo sống nhưng phần đã giao bù đủ → không tính đổi', () => {
    const live = sendReport([itemRow({ key: 'kB', requested: 1, need: 1 })]);
    expect(new Set(changedKeys(live, SENT, { kA: 5, kB: 2, kC: 2 }).keys())).toEqual(new Set());
  });

  it('món rời báo cáo vì bị điều chỉnh giảm sau bản (phần giao không bù đủ) → tính đổi; món đặt 0 rời báo cáo không tính', () => {
    const live = sendReport([itemRow({ key: 'kB', requested: 3, need: 3 })]);
    expect(new Set(changedKeys(live, SENT, { kA: 2 }).keys())).toEqual(new Set(['kA']));
  });

  it('giao một phần: cần nay + đã giao = cần lúc gửi → không đổi; đăng ký thêm sau bản → đổi', () => {
    const live = sendReport([itemRow({ key: 'kA', requested: 3, need: 3 }), itemRow({ key: 'kB', requested: 4, need: 4 }), itemRow({ key: 'kC', requested: 2 })]);
    expect(new Set(changedKeys(live, SENT, { kA: 2 }).keys())).toEqual(new Set(['kB']));
  });

  it('món ngoài danh mục mới duyệt sau bản → đổi', () => {
    const live = sendReport([...SENT_REPORT.byItem], { custom: [{ key: 'custom:x', name: 'Bìa còng', unit: 'cai', requested: 1, backlog_prev: 0, stock: null, need: 1, people: 1 }] });
    expect(new Set(changedKeys(live, SENT, {}).keys())).toEqual(new Set(['custom:x']));
  });

  it('phần xong sau bản (server: giao 1 + hủy NCC hết hàng 4) bù đủ cần lúc chốt → món không bị báo đổi; thiếu phần hủy → đổi', () => {
    const live = sendReport([itemRow({ key: 'kB', requested: 3, need: 3 }), itemRow({ key: 'kC', requested: 2 })]);
    expect(new Set(changedKeys(live, SENT, { kA: 5 }).keys())).toEqual(new Set());
    expect(new Set(changedKeys(live, SENT, { kA: 1 }).keys())).toEqual(new Set(['kA']));
  });
});

describe('changedKeys ghi cả số lúc in và số nay', () => {
  it('đăng ký thêm sau bản (cần 5 lúc in, nay 7) → { was: 5, now: 7 }', () => {
    const live = sendReport([itemRow({ key: 'kA', requested: 7, need: 7 }), itemRow({ key: 'kB', requested: 3, need: 3 })]);
    expect(changedKeys(live, SENT, {}).get('kA')).toEqual({ was: 5, now: 7 });
  });
});
