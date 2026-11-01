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

// Vùng chạm đo bằng hộp thật của nút (như boundingBox), không tính pseudo-element; một lượt evaluateAll vì Danh mục có > 200 nút
export async function expectTouchTargets(page: Page, where: string) {
  const small = await page.getByRole('button').evaluateAll((buttons) =>
    buttons
      .filter((b) => b.checkVisibility({ visibilityProperty: true, opacityProperty: true }))
      .map((b) => ({ b, box: b.getBoundingClientRect() }))
      .filter(({ box }) => box.width > 0 && (box.width < 44 || box.height < 44))
      .map(({ b, box }) => `${b.getAttribute('aria-label') ?? (b as HTMLElement).innerText.trim()} ${Math.round(box.width)}×${Math.round(box.height)}`),
  );
  expect(small, `nút < 44×44 ở ${where}`).toEqual([]);
}

// Bảng giữ hàng cũ (mờ, aria-busy) lúc tải kết quả tìm; chờ theo thứ người dùng thấy thay vì bắt một response (từng treo ở 390)
export async function searchSummaryPeople(page: Page, text: string) {
  await page.getByRole('searchbox', { name: 'Tìm người, email…' }).fill(text);
  await expect.poll(() => new URL(page.url()).searchParams.get('q')).toBe(text);
  await expect(page.getByRole('row').filter({ hasText: text }).first()).toBeVisible();
  await expect(page.getByRole('table')).toHaveAttribute('aria-busy', 'false');
}

// Spinner quay vô hạn: finished không bao giờ xong → evaluate treo tới hết giờ test ("browserContext.close: Test ended")
export async function settled(page: Page) {
  // aria-busy là trạng thái ARIA người dùng trợ năng thấy, không phải class; getByRole không lọc theo aria-busy nên giữ selector này
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((a) => a.effect?.getComputedTiming().iterations !== Infinity)
        .map((a) => a.finished),
    ),
  );
}

export const devHeaders = (role: 'member' | 'admin' | 'sa') => ({ 'x-dev-user-sub': `pw-${role}`, 'x-dev-role': role });

// Tab mới không có route dev-identity của page (phiên SA thì cookie đã đủ): thêm ở mức context, chờ tab tới đúng trang rồi trả URL để mở lại trên trang đang kiểm
export async function urlOfNewTab(page: Page, expected: RegExp, open: () => Promise<void>, headers?: Record<string, string>): Promise<string> {
  if (headers) await page.context().route('**/api/**', (route) => route.continue({ headers: { ...route.request().headers(), ...headers } }));
  const next = page.context().waitForEvent('page');
  await open();
  const tab = await next;
  await tab.waitForURL(expected);
  const url = tab.url();
  await tab.close();
  return url;
}

const REPO_ROOT = fileURLToPath(new URL('../..', import.meta.url));

// psql trong container postgres dev; trả stdout (-tA) để đọc giá trị RETURNING
export function psql(sql: string): string {
  return execFileSync(
    'docker',
    ['compose', 'exec', '-T', 'postgres', 'sh', '-c', 'psql -v ON_ERROR_STOP=1 -q -tA -U "$POSTGRES_USER" -d "$POSTGRES_DB"'],
    { cwd: REPO_ROOT, input: sql, encoding: 'utf8' },
  ).trim();
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

// Bản ghi trước, tệp sau (như job dọn tệp của api); ảnh còn được món/dòng phiếu trỏ tới thì giữ
export function deleteTestFiles(ids: string[]) {
  const list = ids.filter((id) => UUID.test(id));
  if (list.length === 0) return;
  const deleted = psql(`DELETE FROM files f WHERE f.id IN (${list.map((id) => `'${id}'`).join(', ')})
      AND NOT EXISTS (SELECT 1 FROM items i WHERE i.image_file_id = f.id)
      AND NOT EXISTS (SELECT 1 FROM request_lines l WHERE l.image_file_id = f.id)
    RETURNING f.id`)
    .split('\n')
    .filter((id) => UUID.test(id));
  if (deleted.length === 0) return;
  execFileSync('docker', ['compose', 'exec', '-T', 'api', 'sh', '-c', `rm -f ${deleted.map((id) => `/data/files/${id}.*`).join(' ')}`], {
    cwd: REPO_ROOT,
  });
}

// Người thử mang hậu tố riêng: xóa phiếu rồi xóa người để không lọt vào danh bạ / "chưa đăng ký" của DB dev;
// ảnh họ đã tải (dòng ngoài danh mục) xóa theo để kho tệp dev không đầy tệp mồ côi
export function deleteTestUsers(...subs: string[]) {
  const list = subs.map((s) => `'${s}'`).join(', ');
  const files = psql(`SELECT id FROM files WHERE uploaded_by_sub IN (${list})`).split('\n');
  psql(`DELETE FROM requests WHERE user_sub IN (${list}); DELETE FROM users WHERE sub IN (${list})`);
  deleteTestFiles(files);
}

// Món đã có sổ kho/dòng phiếu thì không xóa được (ITEM_IN_USE) → ngừng thay vì xóa, ảnh giữ theo món
export async function removeTestItem(request: APIRequestContext, id: string) {
  const headers = devHeaders('admin');
  const image = psql(`SELECT image_file_id FROM items WHERE id = '${id}'`);
  const res = await request.delete(`/api/admin/items/${id}`, { headers });
  if (res.ok()) deleteTestFiles([image]);
  else expect((await request.patch(`/api/admin/items/${id}`, { headers, data: { active: false } })).ok()).toBe(true);
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
