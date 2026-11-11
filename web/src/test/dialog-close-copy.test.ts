import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import en from '@/locales/en';
import vi from '@/locales/vi';

// Nút đóng hộp thoại (không làm gì) luôn là "Quay lại"/"Back"; "Hủy …" chỉ cho hành động thật
type Tree = { [k: string]: string | Tree };
const get = (tree: Tree, path: string): unknown => path.split('.').reduce<unknown>((o, k) => (o as Tree | undefined)?.[k], tree);

const SRC = resolve(__dirname, '..');
function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(p) && !/\.test\.tsx?$/.test(p)) out.push(p);
  }
  return out;
}

// Mọi chỗ đặt nhãn nút đóng: cancelLabel của hộp xác nhận và chữ của nút nằm trong <DialogClose>
type Site = { file: string; key: string; kind: 'cancelLabel' | 'DialogClose' };
const sites: Site[] = walk(SRC).flatMap((file) => {
  const text = readFileSync(file, 'utf8');
  const rel = file.replace(SRC, '');
  const cancel = [...text.matchAll(/cancelLabel(?::|=\{)\s*t\(\s*'([\w.]+)'/g)].map((m) => ({ file: rel, key: m[1]!, kind: 'cancelLabel' as const }));
  const close = [...text.matchAll(/<DialogClose\b[^>]*>([\s\S]*?)<\/DialogClose>/g)].flatMap((m) =>
    [...(m[1] ?? '').matchAll(/>\s*\{t\(\s*'([\w.]+)'/g)].slice(0, 1).map((k) => ({ file: rel, key: k[1]!, kind: 'DialogClose' as const })),
  );
  return [...cancel, ...close];
});

// Lựa chọn thật (không phải nút đóng): ở lại trang, giữ giỏ hiện có
const CHOICES = new Set(['Ở lại', 'Giữ giỏ', 'Đóng, xem giỏ của tôi']);
const BANNED = /^(Hủy|Cancel|Tiếp tục sửa|Keep editing|Quay lại sửa)$/;

describe('Nút đóng hộp thoại là "Quay lại"', () => {
  it('tìm được các chỗ đặt nhãn đóng trong mã (hộp xác nhận + DialogClose)', () => {
    expect(sites.filter((s) => s.kind === 'cancelLabel').length).toBeGreaterThanOrEqual(7);
    expect(sites.filter((s) => s.kind === 'DialogClose').length).toBeGreaterThanOrEqual(10);
    expect(sites.map((s) => s.key)).toContain('common.cancel');
  });

  it('mọi cancelLabel là "Quay lại"/"Back" (trừ lựa chọn ở lại/giữ giỏ)', () => {
    const bad = sites
      .filter((s) => s.kind === 'cancelLabel')
      .filter((s) => {
        const v = get(vi as unknown as Tree, s.key);
        return !CHOICES.has(String(v)) && (v !== 'Quay lại' || get(en as unknown as Tree, s.key) !== 'Back');
      })
      .map((s) => `${s.file}: ${s.key} = ${String(get(vi as unknown as Tree, s.key))}`);
    expect(bad).toEqual([]);
  });

  it('không nút đóng nào là "Hủy"/"Cancel"/"Tiếp tục sửa"/"Keep editing"', () => {
    const bad = sites
      .filter((s) => BANNED.test(String(get(vi as unknown as Tree, s.key))) || BANNED.test(String(get(en as unknown as Tree, s.key))))
      .map((s) => `${s.file}: ${s.key}`);
    expect(bad).toEqual([]);
  });

  it('nút đóng mặc định của hộp xác nhận: vi "Quay lại", en "Back"', () => {
    expect(get(vi as unknown as Tree, 'common.cancel')).toBe('Quay lại');
    expect(get(en as unknown as Tree, 'common.cancel')).toBe('Back');
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
