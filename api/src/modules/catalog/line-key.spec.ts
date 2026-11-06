import { LineKeyPipe, parseLineKey } from './line-key';

describe('parseLineKey', () => {
  it('uuid → khóa món (chữ thường), item_id = khóa', () => {
    const id = 'A1B2C3D4-0000-4000-8000-00000000000A';
    expect(parseLineKey(id)).toEqual({
      key: id.toLowerCase(),
      item_id: id.toLowerCase(),
    });
  });

  it('khóa custom đúng dạng jsonb (", ", ngoặc, dấu, khoảng trắng, ký tự cần thoát) → giữ nguyên, item_id null', () => {
    for (const key of [
      'custom:["kéo cắt giấy", "cái"]',
      'custom:["bìa \\"đặc biệt\\" / a4", "cuộn"]',
      'custom:["a\\\\b", "c"]',
    ]) {
      expect(parseLineKey(key)).toEqual({ key, item_id: null });
    }
  });

  it('khóa hỏng → null: thiếu khoảng trắng sau dấu phẩy, 1 hoặc 3 phần tử, không phải chuỗi, rỗng, không JSON, tiền tố lạ', () => {
    for (const bad of [
      'custom:["a","b"]',
      'custom:["a"]',
      'custom:["a", "b", "c"]',
      'custom:[1, 2]',
      'custom:["", "b"]',
      'custom:not-json',
      'item:["a", "b"]',
      'abc',
      '',
    ]) {
      expect(parseLineKey(bad)).toBeNull();
    }
    expect(parseLineKey(42)).toBeNull();
  });

  it('LineKeyPipe: khóa hỏng → 400 VALIDATION fields [line_key]', () => {
    let error: unknown;
    try {
      new LineKeyPipe().transform('custom:x');
    } catch (e) {
      error = e;
    }
    expect((error as { getResponse: () => object }).getResponse()).toEqual(
      expect.objectContaining({ code: 'VALIDATION', fields: ['line_key'] }),
    );
  });
});
