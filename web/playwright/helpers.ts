import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type APIRequestContext, type Page, type TestInfo } from '@playwright/test';

// Header dev-identity chỉ gắn cho /api: gắn toàn cục (extraHTTPHeaders) làm request font Google
// thành CORS có header lạ và bị từ chối → trang rơi về font hệ thống
export function asRole(role: 'member' | 'admin' | 'sa') {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', (route) =>
      route.continue({
        headers: { ...route.request().headers(), 'x-dev-user-sub': `pw-${role}`, 'x-dev-role': role },
      }),
    );
  });
}

export const isMobile = (info: TestInfo) => info.project.name === 'mobile-390';

export async function shot(page: Page, info: TestInfo, name: string, fullPage = true) {
  // Font Google hiển thị kiểu swap: chụp trước khi tải xong sẽ ra font hệ thống
  await page.evaluate(() => document.fonts.ready);
  // Đầu trang dính (sticky) bị chụp đè giữa ảnh fullPage nếu trang đang cuộn
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: `test-results/screens/${name}-${info.project.name}.png`, fullPage });
}

export async function expectNoContrastViolations(page: Page) {
  const result = await new AxeBuilder({ page }).withRules(['color-contrast']).analyze();
  expect(result.violations.flatMap((v) => v.nodes.map((n) => n.target.join(' ')))).toEqual([]);
}

export const devHeaders = (role: 'member' | 'admin' | 'sa') => ({ 'x-dev-user-sub': `pw-${role}`, 'x-dev-role': role });

const REPO_ROOT = fileURLToPath(new URL('../..', import.meta.url));

// psql trong container postgres dev; trả stdout (-tA) để đọc giá trị RETURNING
export function psql(sql: string): string {
  return execFileSync(
    'docker',
    ['compose', 'exec', '-T', 'postgres', 'sh', '-c', 'psql -v ON_ERROR_STOP=1 -q -tA -U "$POSTGRES_USER" -d "$POSTGRES_DB"'],
    { cwd: REPO_ROOT, input: sql, encoding: 'utf8' },
  ).trim();
}

// Người thử mang hậu tố riêng: xóa phiếu rồi xóa người để không lọt vào danh bạ / "chưa đăng ký" của DB dev
export function deleteTestUsers(...subs: string[]) {
  const list = subs.map((s) => `'${s}'`).join(', ');
  psql(`DELETE FROM requests WHERE user_sub IN (${list}); DELETE FROM users WHERE sub IN (${list})`);
}

// Món đã có sổ kho/dòng phiếu thì không xóa được (ITEM_IN_USE) → ngừng thay vì xóa
export async function removeTestItem(request: APIRequestContext, id: string) {
  const headers = devHeaders('admin');
  const res = await request.delete(`/api/admin/items/${id}`, { headers });
  if (!res.ok()) expect((await request.patch(`/api/admin/items/${id}`, { headers, data: { active: false } })).ok()).toBe(true);
}

// Dev-identity không tạo dòng users; người nhận xuất lẻ/danh bạ phải có sẵn trong bảng users
export function seedActiveUser(sub: string, fullName: string, status: 'active' | 'locked' = 'active') {
  const sql = `INSERT INTO users (sub, full_name, email, status) VALUES ('${sub}', '${fullName}', '${sub}@example.test', '${status}')
    ON CONFLICT (sub) DO UPDATE SET full_name = EXCLUDED.full_name, status = EXCLUDED.status`;
  execFileSync(
    'docker',
    ['compose', 'exec', '-T', 'postgres', 'sh', '-c', 'psql -v ON_ERROR_STOP=1 -q -U "$POSTGRES_USER" -d "$POSTGRES_DB"'],
    { cwd: REPO_ROOT, input: sql, stdio: ['pipe', 'ignore', 'inherit'] },
  );
}

const LOCK_STALE_MS = 120_000;

// Hai project (1280/390) chạy song song trên cùng DB dev: test sửa dữ liệu dùng chung phải lần lượt
export async function acquireLock(name: string): Promise<() => void> {
  const dir = `test-results/locks/${name}`;
  mkdirSync('test-results/locks', { recursive: true });
  for (;;) {
    try {
      mkdirSync(dir);
      return () => rmSync(dir, { recursive: true, force: true });
    } catch {
      const held = statSync(dir, { throwIfNoEntry: false });
      if (held && Date.now() - held.mtimeMs > LOCK_STALE_MS) rmSync(dir, { recursive: true, force: true });
      await new Promise((r) => setTimeout(r, 200));
    }
  }
}
