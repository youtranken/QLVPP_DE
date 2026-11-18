export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface Pixels extends Size {
  data: Uint8ClampedArray;
}

export type Handle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

export const MIN_CROP = 16;
// Ảnh chụp/scan có nền hơi xám do nén JPEG; 245 bắt được nền đó mà không ăn vào nội dung sáng
export const WHITE_THRESHOLD = 245;

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

function isBackground(d: Uint8ClampedArray, i: number): boolean {
  if (d[i + 3] === 0) return true;
  return d[i] >= WHITE_THRESHOLD && d[i + 1] >= WHITE_THRESHOLD && d[i + 2] >= WHITE_THRESHOLD;
}

export function findContentBox({ width, height, data }: Pixels): Rect {
  let left = width;
  let top = height;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (isBackground(data, (y * width + x) * 4)) continue;
      if (x < left) left = x;
      if (x > right) right = x;
      if (y < top) top = y;
      if (y > bottom) bottom = y;
    }
  }
  if (right < 0) return { x: 0, y: 0, w: width, h: height };
  return { x: left, y: top, w: right - left + 1, h: bottom - top + 1 };
}

export function resizeCrop(r: Rect, handle: Handle, dx: number, dy: number, bounds: Size): Rect {
  let left = r.x;
  let top = r.y;
  let right = r.x + r.w;
  let bottom = r.y + r.h;
  // Ảnh nhỏ hơn MIN_CROP: khung tối thiểu là cả ảnh, không để cạnh chạy ra ngoài (x/y âm)
  const minW = Math.min(MIN_CROP, bounds.width);
  const minH = Math.min(MIN_CROP, bounds.height);
  if (handle.includes('w')) left = clamp(left + dx, 0, right - minW);
  if (handle.includes('e')) right = clamp(right + dx, left + minW, bounds.width);
  if (handle.includes('n')) top = clamp(top + dy, 0, bottom - minH);
  if (handle.includes('s')) bottom = clamp(bottom + dy, top + minH, bounds.height);
  return { x: left, y: top, w: right - left, h: bottom - top };
}

export function moveCrop(r: Rect, dx: number, dy: number, bounds: Size): Rect {
  return {
    ...r,
    x: clamp(r.x + dx, 0, bounds.width - r.w),
    y: clamp(r.y + dy, 0, bounds.height - r.h),
  };
}

const ARROWS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

export function nudgeCrop(r: Rect, key: string, shift: boolean, bounds: Size, step = 1): Rect | null {
  const dir = ARROWS[key];
  if (!dir) return null;
  const [dx, dy] = [dir[0] * step, dir[1] * step];
  if (!shift) return moveCrop(r, dx, dy, bounds);
  return resizeCrop(r, dx ? 'e' : 's', dx, dy, bounds);
}
