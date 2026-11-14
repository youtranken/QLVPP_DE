import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import vi from '@/locales/vi';
import en from '@/locales/en';
import { ADMIN_NAV } from '@/shell/admin-nav';

type Tree = Record<string, unknown>;
const get = (tree: Tree, key: string): string => {
  const v = key.split('.').reduce<unknown>((n, k) => (n as Tree | undefined)?.[k], tree);
  if (typeof v !== 'string') throw new Error(`thiếu khóa ${key}`);
  return v;
};
function strings(node: unknown, path = ''): [string, string][] {
  if (typeof node === 'string') return [[path, node]];
  if (node && typeof node === 'object') return Object.entries(node).flatMap(([k, v]) => strings(v, path ? `${path}.${k}` : k));
  return [];
}

// Khóa tiêu đề h1 của từng trang trong menu quản lý. Trang có tháng trong tiêu đề ("Kỳ tháng 12") so phần chữ đứng trước số
const PAGE_TITLE: Record<string, { key: string; dynamic?: true }> = {
  month: { key: 'month.title', dynamic: true },
  reports: { key: 'reports.send.title' },
  arrivals: { key: 'arrivals.title', dynamic: true },
  delivery: { key: 'delivery.people.title', dynamic: true },
  backlog: { key: 'delivery.backlog.title' },
  catalog: { key: 'catalog.title' },
  stock: { key: 'stock.page.title' },
  review: { key: 'nav.review' },
  categories: { key: 'catalog.setup.title' },
  users: { key: 'users.title' },
  audit: { key: 'audit.title' },
  config: { key: 'config.title' },
};

describe('Chữ: một khái niệm, một tên', () => {
  const items = ADMIN_NAV.flatMap((g) => g.pages);

  it('mọi mục menu quản lý đều có khóa tiêu đề trang để so', () => {
    expect(items.map((i) => i.path).filter((p) => !PAGE_TITLE[p])).toEqual([]);
  });

  it.each([
    ['vi', vi],
    ['en', en],
  ] as const)('%s: nhãn menu trùng tiêu đề trang (vd "Danh bạ" ở cả menu và trang)', (_lang, tree) => {
    const off = items.flatMap((i) => {
      const nav = get(tree as Tree, i.titleKey);
      const page = PAGE_TITLE[i.path]!;
      const title = get(tree as Tree, page.key);
      if (!page.dynamic) return title === nav ? [] : [`${i.path}: menu "${nav}" ≠ trang "${title}"`];
      // Tiêu đề có tháng: tiếng Việt đọc "<nhãn menu> … tháng n"; tiếng Anh gọi tên tháng nên chỉ cần chung chữ chính
      const head = title.split('{{')[0]!.trim();
      return _lang === 'vi' && !head.startsWith(nav.split(' ')[0]!) ? [`${i.path}: menu "${nav}" ≠ trang "${title}"`] : [];
    });
    expect(off).toEqual([]);
  });

  it('vi: Danh bạ (theo PRD FR-80 và danh sách sidebar), không "Nhân viên" cho trang người dùng', () => {
    expect(get(vi as Tree, 'nav.users')).toBe('Danh bạ');
    expect(get(vi as Tree, 'users.title')).toBe('Danh bạ');
  });

  it('dòng đếm một mẫu: "Đang hiện x/y …" (vi) / "Showing x/y …" (en), không "Hiện x / y"', () => {
    // Mọi câu đếm "đang hiện bao nhiêu" (có số ngay sau chữ hiện/Showing)
    const vCounts = strings(vi).filter(([, s]) => /hiện \{\{\w+\}\}/i.test(s));
    const eCounts = strings(en).filter(([, s]) => /showing \{\{\w+\}\}/i.test(s));
    expect(vCounts.length).toBeGreaterThan(2);
    expect(vCounts.filter(([, s]) => !/^Đang hiện \{\{\w+\}\}(\/\{\{\w+\}\})? \S/.test(s))).toEqual([]);
    expect(eCounts.filter(([, s]) => !/^Showing \{\{\w+\}\}(\/\{\{\w+\}\})? \S/.test(s))).toEqual([]);
    expect(strings(vi).filter(([, s]) => /^Hiện \{\{/.test(s))).toEqual([]);
  });

  it('vi: nút bỏ bộ lọc chỉ một chữ "Xóa lọc" (không "Bỏ lọc", "Xóa bộ lọc")', () => {
    expect(strings(vi).filter(([, s]) => /^(Bỏ lọc|Xóa bộ lọc)$/.test(s))).toEqual([]);
    expect(get(vi as Tree, 'common.filter.clear')).toBe('Xóa lọc');
  });

  // Chủ dự án chốt 14/11/2026: người dùng thấy "Tài khoản D&E" / "D&E Account", tên tích hợp PMH ID chỉ còn trong code
  it.each([
    ['vi', vi, 'Tài khoản D&E', /tài khoản d&e/gi],
    ['en', en, 'D&E Account', /d&e account/gi],
  ] as const)('%s: gọi hệ thống đăng nhập là "%s", không còn "PMH ID" trong chuỗi nào', (_lang, tree, term, any) => {
    const all = strings(tree);
    expect(all.filter(([, s]) => /PMH\s*ID/i.test(s)).map(([k]) => k)).toEqual([]);
    expect(all.filter(([, s]) => s.includes(term)).length).toBeGreaterThan(10);
    // Một cách viết: viết hoa đúng như chủ dự án ("Tài khoản D&E", không "tài khoản D&E" hay "Tài Khoản D&E")
    const offCase = all.flatMap(([k, s]) => (s.match(any) ?? []).filter((m) => m !== term).map((m) => `${k}: ${m}`));
    expect(offCase).toEqual([]);
  });

  it('en: tháng gọi bằng tên — không còn "month {{…}}" / "Month {{…}}" (dùng {{month, monthName}})', () => {
    const hits = strings(en).filter(([k, s]) => !k.startsWith('warn.') && /\b[Mm]onth \{\{(month|prev|next|open)\}\}/.test(s));
    expect(hits).toEqual([]);
  });
});

// Ngày giờ hiện cho người dùng luôn năm 4 số: dateStyle 'short' của vi-VN ra "12/11/26"
describe('Ngày giờ: không dateStyle short', () => {
  const root = resolve(__dirname, '..');
  const files = (dir: string): string[] =>
    readdirSync(dir).flatMap((f) => {
      const p = join(dir, f);
      if (statSync(p).isDirectory()) return files(p);
      return /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f) ? [p] : [];
    });

  it("không file nào trong src dùng dateStyle: 'short' hay year: '2-digit'", () => {
    const hits = files(root).filter((p) => /dateStyle:\s*['"]short['"]|year:\s*['"]2-digit['"]/.test(readFileSync(p, 'utf8')));
    expect(hits.map((p) => p.slice(root.length + 1))).toEqual([]);
  });
});
