import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(__dirname, '../../..');
// Ghép từ mảnh để chính tệp này không thành một kết quả khi grep tên đã gỡ (OnBehalf phủ cả tên hàm tạo hộ cũ)
const FORBIDDEN = new RegExp(['on_behalf', 'OnBehalf', 'REQUEST_EXISTS', 'USER_IS_ADMIN', 'summary\\.create', 'Tạo phiếu hộ'].join('|'));
const EXCLUDE_FLAG = ['exclude', 'admin'].join('_');
const THIS_FILE = relative(ROOT, __filename);

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (name === 'node_modules' || name.startsWith('.')) return [];
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const hits = (dirs: string[], pattern: RegExp) =>
  dirs
    .flatMap((d) => walk(join(ROOT, d)))
    .filter((f) => /\.(ts|tsx|css|json)$/.test(f) && relative(ROOT, f) !== THIS_FILE)
    .filter((f) => pattern.test(readFileSync(f, 'utf8')))
    .map((f) => relative(ROOT, f));

// Hành chính không tạo phiếu thay nhân viên: mã, chữ và test của tính năng đã gỡ không được quay lại
describe('gỡ "Tạo phiếu hộ" — quét mã', () => {
  it('api/src, web/src, web/playwright không còn tên/mã/chữ của tạo hộ', () => {
    expect(hits(['api/src', 'web/src', 'web/playwright'], FORBIDDEN)).toEqual([]);
  });

  it('hai file test của tính năng đã xóa; test mẫu số headcount vẫn còn', () => {
    expect(existsSync(join(ROOT, 'api/test/admin-requests-create.e2e-spec.ts'))).toBe(false);
    expect(existsSync(join(ROOT, 'api/test/admin-users-exclude-admin.e2e-spec.ts'))).toBe(false);
    expect(existsSync(join(ROOT, 'api/test/summary-headcount.db-spec.ts'))).toBe(true);
  });

  it('docs/prd.md, architecture.md, map.md không còn POST admin/requests và cờ loại Hành chính', () => {
    const docs = ['docs/prd.md', 'docs/architecture.md', 'docs/map.md'].filter((d) => {
      const text = readFileSync(join(ROOT, d), 'utf8');
      return /POST\s+\/?(api\/)?admin\/requests(?![/\w])/.test(text) || text.includes(EXCLUDE_FLAG);
    });
    expect(docs).toEqual([]);
  });
});
