import {
  CUSTOM,
  ITEM,
  PLAIN,
  openWorkbook,
  rowValues as values,
  snapshotData,
} from './xlsx-snapshot.fixture-spec';

const form = async (data = snapshotData()) =>
  (await openWorkbook('vi', data)).worksheets[0];

describe('buildWorkbook · bản thay thế', () => {
  it('bản có replaces 09:02 12/12 (giờ VN) → A1 đậm "Thay thế bản in lúc 09:02 12/12", tiêu đề phiếu xuống A2', async () => {
    const ws = await form(
      snapshotData({
        replaces: { id: 'old', created_at: '2026-12-12T02:02:00.000Z' },
      }),
    );
    expect(ws.getCell('A1').value).toBe('Thay thế bản in lúc 09:02 12/12');
    expect(ws.getCell('A1').font.bold).toBe(true);
    expect(ws.getCell('F1').master.address).toBe('A1');
    expect(ws.getCell('A2').value).toBe('Phiếu đề xuất văn phòng phẩm');
    expect(ws.getCell('A3').value).toBe('STATIONERY REQUEST FORM');
    expect(values(ws, 4)[2]).toBe('Date :');
    expect(values(ws, 7)).toEqual([
      1,
      'B31',
      'Bút bi',
      'Ballpoint pen',
      'cây',
      7,
    ]);
  });

  it('mốc giờ VN: 16:59Z → "23:59 11/12"; 17:00Z → "00:00 12/12"', async () => {
    const at = async (iso: string) =>
      (
        await form(snapshotData({ replaces: { id: 'old', created_at: iso } }))
      ).getCell('A1').value;
    expect(await at('2026-12-11T16:59:59.999Z')).toBe(
      'Thay thế bản in lúc 23:59 11/12',
    );
    expect(await at('2026-12-11T17:00:00.000Z')).toBe(
      'Thay thế bản in lúc 00:00 12/12',
    );
  });

  it('bản không có replaces → A1 vẫn là tiêu đề phiếu, không dòng thay thế', async () => {
    const ws = await form();
    expect(ws.getCell('A1').value).toBe('Phiếu đề xuất văn phòng phẩm');
    let found = false;
    ws.eachRow((r) => {
      if (String(r.getCell(1).value ?? '').startsWith('Thay thế')) found = true;
    });
    expect(found).toBe(false);
  });

  it('bản có order_basis: hàng Đề nghị 0 vẫn có trên phiếu với SL 0 (một ô 0, các ô khác > 0)', async () => {
    const ws = await form(
      snapshotData({
        order_qty: { [ITEM]: 0, [PLAIN]: 1, [CUSTOM]: 3 },
        order_basis: {},
      }),
    );
    expect([6, 7, 8].map((n) => [values(ws, n)[2], values(ws, n)[5]])).toEqual([
      ['Bút bi', 0],
      ['Kẹp giấy', 1],
      ['Bìa còng', 3],
    ]);
  });

  it('bản cũ không có order_basis: xuất lại không thêm hàng Đề nghị 0', async () => {
    const ws = await form(
      snapshotData({ order_qty: { [ITEM]: 0, [PLAIN]: 1, [CUSTOM]: 3 } }),
    );
    expect([6, 7].map((n) => [values(ws, n)[2], values(ws, n)[5]])).toEqual([
      ['Kẹp giấy', 1],
      ['Bìa còng', 3],
    ]);
  });
});
