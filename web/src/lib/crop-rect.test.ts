import { describe, expect, it } from 'vitest';
import { MIN_CROP, WHITE_THRESHOLD, findContentBox, moveCrop, nudgeCrop, resizeCrop } from './crop-rect';

function image(width: number, height: number, ink: (x: number, y: number) => number | null) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const v = ink(x, y) ?? 255;
      data.set([v, v, v, 255], (y * width + x) * 4);
    }
  return { width, height, data };
}

describe('findContentBox — tự cắt viền trắng', () => {
  it('ảnh toàn trắng → giữ nguyên cả ảnh', () => {
    expect(findContentBox(image(10, 8, () => null))).toEqual({ x: 0, y: 0, w: 10, h: 8 });
  });

  it('viền trắng 1 px quanh ảnh 6×5 → cắt còn 4×3 tại (1,1)', () => {
    const img = image(6, 5, (x, y) => (x >= 1 && x <= 4 && y >= 1 && y <= 3 ? 0 : null));
    expect(findContentBox(img)).toEqual({ x: 1, y: 1, w: 4, h: 3 });
  });

  it('không có viền trắng → giữ nguyên', () => {
    expect(findContentBox(image(4, 4, () => 0))).toEqual({ x: 0, y: 0, w: 4, h: 4 });
  });

  it(`ngưỡng ${WHITE_THRESHOLD}: pixel ${WHITE_THRESHOLD} tính là trắng, ${WHITE_THRESHOLD - 1} là nội dung`, () => {
    const at = (v: number) => image(3, 3, (x, y) => (x === 1 && y === 1 ? 0 : x === 0 && y === 0 ? v : null));
    expect(findContentBox(at(WHITE_THRESHOLD))).toEqual({ x: 1, y: 1, w: 1, h: 1 });
    expect(findContentBox(at(WHITE_THRESHOLD - 1))).toEqual({ x: 0, y: 0, w: 2, h: 2 });
  });

  it('pixel trong suốt tính là nền', () => {
    const img = image(3, 1, (x) => (x === 1 ? 0 : null));
    img.data[3] = 0;
    img.data.set([0, 0, 0, 0], 8);
    expect(findContentBox(img)).toEqual({ x: 1, y: 0, w: 1, h: 1 });
  });
});

const B = { width: 200, height: 100 };

describe('resizeCrop — kéo cạnh/góc', () => {
  const r = { x: 50, y: 20, w: 60, h: 40 };

  it('kéo cạnh phải +10 → rộng 70', () => {
    expect(resizeCrop(r, 'e', 10, 0, B)).toEqual({ x: 50, y: 20, w: 70, h: 40 });
  });

  it('kéo góc trên trái −10,−5 → khung lớn ra, mốc dưới phải giữ', () => {
    expect(resizeCrop(r, 'nw', -10, -5, B)).toEqual({ x: 40, y: 15, w: 70, h: 45 });
  });

  it(`thu tới đúng ${MIN_CROP}×${MIN_CROP} được`, () => {
    expect(resizeCrop(r, 'se', -(60 - 16), -(40 - 16), B)).toEqual({ x: 50, y: 20, w: 16, h: 16 });
  });

  it('kéo nhỏ hơn 16 (15) → kẹp ở 16', () => {
    expect(resizeCrop(r, 'se', -(60 - 15), -(40 - 15), B)).toEqual({ x: 50, y: 20, w: 16, h: 16 });
  });

  it('kéo cạnh trái nhỏ hơn 16 → kẹp, mép phải đứng yên', () => {
    expect(resizeCrop(r, 'w', 50, 0, B)).toEqual({ x: 94, y: 20, w: 16, h: 40 });
  });

  it('kéo ra ngoài ảnh → kẹp ở mép ảnh', () => {
    expect(resizeCrop(r, 'ne', 500, -500, B)).toEqual({ x: 50, y: 0, w: 150, h: 60 });
    expect(resizeCrop(r, 'sw', -500, 500, B)).toEqual({ x: 0, y: 20, w: 110, h: 80 });
  });
});

describe('moveCrop — kéo cả khung', () => {
  const r = { x: 50, y: 20, w: 60, h: 40 };
  it('dịch giữ kích thước', () => {
    expect(moveCrop(r, 5, -3, B)).toEqual({ x: 55, y: 17, w: 60, h: 40 });
  });
  it('chạm mép: dịch tới đúng mép được, quá mép bị kẹp', () => {
    expect(moveCrop(r, 90, 40, B)).toEqual({ x: 140, y: 60, w: 60, h: 40 });
    expect(moveCrop(r, 91, 41, B)).toEqual({ x: 140, y: 60, w: 60, h: 40 });
    expect(moveCrop(r, -51, -21, B)).toEqual({ x: 0, y: 0, w: 60, h: 40 });
  });
});

describe('nudgeCrop — bàn phím', () => {
  const r = { x: 50, y: 20, w: 60, h: 40 };
  it('mũi tên dịch khung 1 px', () => {
    expect(nudgeCrop(r, 'ArrowLeft', false, B)).toEqual({ ...r, x: 49 });
    expect(nudgeCrop(r, 'ArrowDown', false, B)).toEqual({ ...r, y: 21 });
  });
  it('Shift+mũi tên đổi cạnh phải/dưới', () => {
    expect(nudgeCrop(r, 'ArrowRight', true, B)).toEqual({ ...r, w: 61 });
    expect(nudgeCrop(r, 'ArrowUp', true, B)).toEqual({ ...r, h: 39 });
  });
  it('bước tùy chọn và vẫn kẹp trong ảnh / tối thiểu 16', () => {
    expect(nudgeCrop({ x: 0, y: 0, w: 16, h: 16 }, 'ArrowLeft', true, B, 10)).toEqual({ x: 0, y: 0, w: 16, h: 16 });
    expect(nudgeCrop({ x: 0, y: 0, w: 16, h: 16 }, 'ArrowUp', false, B, 10)).toEqual({ x: 0, y: 0, w: 16, h: 16 });
  });
  it('phím khác → trả null', () => {
    expect(nudgeCrop(r, 'Enter', false, B)).toBeNull();
  });
});

describe('resizeCrop — ảnh nhỏ hơn MIN_CROP', () => {
  const tiny = { width: 10, height: 8 };
  const whole = { x: 0, y: 0, w: 10, h: 8 };

  it('ảnh 10×8: kéo góc nw/se vào trong → không x/y âm, khung giữ cả ảnh (min hiệu dụng = cỡ ảnh)', () => {
    expect(resizeCrop(whole, 'nw', 5, 5, tiny)).toEqual(whole);
    expect(resizeCrop(whole, 'se', -5, -5, tiny)).toEqual(whole);
  });

  it('biên min hiệu dụng: ảnh rộng đúng MIN_CROP → không co được; rộng MIN_CROP + 1 → co được đúng 1', () => {
    const at = { x: 0, y: 0, w: MIN_CROP, h: MIN_CROP };
    expect(resizeCrop(at, 'w', 3, 0, { width: MIN_CROP, height: MIN_CROP })).toEqual(at);
    const wide = { x: 0, y: 0, w: MIN_CROP + 1, h: MIN_CROP };
    expect(resizeCrop(wide, 'w', 3, 0, { width: MIN_CROP + 1, height: MIN_CROP })).toEqual({ x: 1, y: 0, w: MIN_CROP, h: MIN_CROP });
  });
});
