import { MAX_IMAGE_BYTES, extensionFor, sniff } from './file-validation';

const jpg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
const png = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00,
]);
const webp = Buffer.concat([
  Buffer.from('RIFF'),
  Buffer.from([0x10, 0x00, 0x00, 0x00]),
  Buffer.from('WEBPVP8 '),
]);

describe('sniff — chỉ tin magic bytes, không tin đuôi/Content-Type', () => {
  it('nhận đúng jpeg, png, webp', () => {
    expect(sniff(jpg)).toBe('image/jpeg');
    expect(sniff(png)).toBe('image/png');
    expect(sniff(webp)).toBe('image/webp');
  });

  it('exe (MZ) → null', () => {
    expect(sniff(Buffer.from([0x4d, 0x5a, 0x90, 0x00]))).toBeNull();
  });

  it('RIFF nhưng không phải WEBP (WAVE) → null', () => {
    const wav = Buffer.concat([
      Buffer.from('RIFF'),
      Buffer.alloc(4),
      Buffer.from('WAVE'),
    ]);
    expect(sniff(wav)).toBeNull();
  });

  it('pdf và zip không còn trong whitelist ảnh → null', () => {
    expect(sniff(Buffer.from('%PDF-1.7\n'))).toBeNull();
    expect(sniff(Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]))).toBeNull();
  });

  it('buffer ngắn hơn magic → null, không crash', () => {
    expect(sniff(Buffer.from([0xff]))).toBeNull();
    expect(sniff(Buffer.alloc(0))).toBeNull();
  });
});

describe('giới hạn và đuôi tệp', () => {
  it('trần ảnh 5 MB', () => {
    expect(MAX_IMAGE_BYTES).toBe(5 * 1024 * 1024);
  });

  it('đuôi lưu đĩa suy từ mime', () => {
    expect(extensionFor('image/jpeg')).toBe('jpg');
    expect(extensionFor('image/png')).toBe('png');
    expect(extensionFor('image/webp')).toBe('webp');
  });
});
