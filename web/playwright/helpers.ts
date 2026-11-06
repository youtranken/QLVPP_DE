import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type APIRequestContext, type Locator, type Page, type TestInfo } from '@playwright/test';

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
  const small = await page.locator('button, [role="radio"], input[type="checkbox"], input[type="search"]').evaluateAll((controls) =>
    controls
      .filter((b) => b.checkVisibility({ visibilityProperty: true, opacityProperty: true }))
      .map((b) => ({ b, box: b.getBoundingClientRect() }))
      .filter(({ box }) => box.width > 0 && (box.width < 44 || box.height < 44))
      .map(({ b, box }) => `${b.getAttribute('aria-label') ?? (b as HTMLElement).innerText?.trim() ?? b.getAttribute('type')} ${Math.round(box.width)}×${Math.round(box.height)}`),
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

// 390: nút chép danh sách nằm trong menu ⋯ ở đầu trang Tổng hợp kỳ
export async function copyUnregisteredList(page: Page, info: TestInfo) {
  if (isMobile(info)) {
    await page.getByRole('button', { name: 'Thao tác khác' }).click();
    await page.getByRole('menuitem', { name: /^Chép DS chưa đăng ký/ }).click();
  } else {
    await page.getByRole('button', { name: /^Chép DS chưa đăng ký/ }).click();
  }
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

const sqlText = (s: string) => `'${s.replaceAll("'", "''")}'`;

// Dev-identity không tạo dòng users; người nhận xuất lẻ/danh bạ phải có sẵn trong bảng users
export function seedActiveUser(
  sub: string,
  fullName: string,
  status: 'active' | 'locked' = 'active',
  extra: { department?: string; groups?: string[] } = {},
) {
  const department = extra.department ? sqlText(extra.department) : 'NULL';
  const groups = extra.groups ? `${sqlText(JSON.stringify(extra.groups))}::jsonb` : "'[]'::jsonb";
  const sql = `INSERT INTO users (sub, full_name, email, status, department, groups)
    VALUES (${sqlText(sub)}, ${sqlText(fullName)}, ${sqlText(`${sub}@example.test`)}, '${status}', ${department}, ${groups})
    ON CONFLICT (sub) DO UPDATE SET full_name = EXCLUDED.full_name, status = EXCLUDED.status
      ${extra.department ? ', department = EXCLUDED.department' : ''}${extra.groups ? ', groups = EXCLUDED.groups' : ''}`;
  execFileSync(
    'docker',
    ['compose', 'exec', '-T', 'postgres', 'sh', '-c', 'psql -v ON_ERROR_STOP=1 -q -U "$POSTGRES_USER" -d "$POSTGRES_DB"'],
    { cwd: REPO_ROOT, input: sql, stdio: ['pipe', 'ignore', 'inherit'] },
  );
}

let pwItemSeq = 0;

// Món thử riêng của test (không dựa vào danh mục dev): có ảnh để nhân viên thấy, tồn gieo thẳng; dọn bằng removeTestItem
export async function seedPwItem(page: Page, opts: { stock?: number; group?: string } = {}): Promise<{ id: string; name: string }> {
  const headers = devHeaders('admin');
  const name = `PW món ${Date.now().toString(36)}${(pwItemSeq++).toString(36)}-${page.viewportSize()?.width ?? 0}`;
  const group = opts.group && (opts.group.startsWith('PW ') ? opts.group : `PW ${opts.group}`);
  const categoryId = group
    ? psql(`INSERT INTO item_categories (name) VALUES (${sqlText(group)})
        ON CONFLICT ((lower(name))) DO UPDATE SET active = true RETURNING id`)
    : undefined;
  const file = await page.request.post('/api/files', {
    headers,
    multipart: { purpose: 'item_image', file: { name: 'item.png', mimeType: 'image/png', buffer: readFileSync('playwright/fixtures/item.png') } },
  });
  expect(file.status()).toBe(201);
  const item = await page.request.post('/api/admin/items', {
    headers,
    data: { name, unit: 'cai', max_qty: 99, image_file_id: (await file.json()).id, ...(categoryId ? { category_id: categoryId } : {}) },
  });
  expect(item.status(), await item.text()).toBe(201);
  const id = (await item.json()).id as string;
  if (opts.stock) psql(`UPDATE items SET stock_qty = ${Number(opts.stock)} WHERE id = '${id}'`);
  return { id, name };
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

// Dòng nhật ký có aria-expanded (chưa mở hoặc đã mở)
export const auditRows = (page: Page) => page.getByRole('table').getByRole('row', { expanded: false }).or(page.getByRole('table').getByRole('row', { expanded: true }));

// Chi tiết nhật ký là hàng riêng ngay dưới; cả dòng mở bằng Enter và trỏ tới chi tiết qua aria-controls
export async function openAuditDetail(page: Page, row: Locator): Promise<Locator> {
  await row.focus();
  await page.keyboard.press('Enter');
  await expect(row).toHaveAttribute('aria-expanded', 'true');
  const id = await row.getAttribute('aria-controls');
  expect(id).toBeTruthy();
  return page.locator(`[id="${id}"]`);
}

// 1280: nút "Nhập mua" trên hàng; 390: nằm trong menu ⋯ của hàng
// Nhập ngoài kỳ chỉ còn trong ⋯ của dòng Tủ/Kho (mọi bề rộng)
export async function openPurchase(page: Page, row: Locator) {
  await row.getByRole('button', { name: /^Thao tác khác cho / }).click();
  await page.getByRole('menu').getByRole('menuitem', { name: 'Nhập ngoài kỳ (tự mua lẻ)', exact: true }).click();
}

// Cột Trong tủ là ô thứ 3 (Món · ĐVT · Trong tủ · Đang giữ · Còn trống); 390 xếp dọc có nhãn cột phía trước
export const stockCellOf = (row: Locator) => row.getByRole('cell').nth(2);
export const expectStockCell = (row: Locator, qty: number) => expect(stockCellOf(row)).toHaveText(new RegExp(`^(Trong tủ\\s*)?${qty}$`));

// ▲▼ dời <tr> theo key: trình duyệt tự bỏ tiêu điểm nếu app không đặt lại; dời dòng đầu xuống tận cuối rồi lên một bậc
export async function expectReorderArrowKeepsFocus(page: Page, menuLabel: RegExp) {
  await page.getByRole('button', { name: 'Sắp xếp' }).click();
  const downs = page.getByRole('button', { name: /^Đưa .+ xuống$/ });
  const count = await downs.count();
  expect(count).toBeGreaterThanOrEqual(3);
  const name = /^Đưa (.+) xuống$/.exec((await downs.first().getAttribute('aria-label'))!)![1];
  const active = () => page.evaluate(() => document.activeElement?.getAttribute('aria-label') ?? document.activeElement?.tagName);
  await page.getByRole('button', { name: `Đưa ${name} xuống`, exact: true }).focus();
  for (let i = 1; i < count - 1; i++) {
    await page.keyboard.press('Enter');
    await expect.poll(active).toBe(`Đưa ${name} xuống`);
  }
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: `Đưa ${name} xuống`, exact: true })).toBeDisabled();
  await expect.poll(active).toBe(`Đưa ${name} lên`);
  await page.keyboard.press('Enter');
  await expect.poll(active).toBe(`Đưa ${name} lên`);
  const labels = await page.getByRole('table').getByRole('button', { name: menuLabel }).evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')));
  expect(labels.at(-2)).toMatch(new RegExp(` ${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`));
  await page.getByRole('button', { name: 'Hủy' }).click();
  await page.getByRole('dialog', { name: 'Bỏ thay đổi chưa lưu?' }).getByRole('button', { name: 'Bỏ thay đổi' }).click();
}

// Phiếu nhân viên: ≥ 901 là khung "complementary" bên phải; ≤ 900 là dialog (sheet) mở từ thanh phiếu nổi
const CART_NAME = /^Phiếu tháng \d+$/;
export const cartOf = (page: Page) =>
  page.getByRole('complementary', { name: CART_NAME }).or(page.getByRole('dialog', { name: CART_NAME }));

export async function openCart(page: Page, info: TestInfo) {
  if (!isMobile(info)) return;
  const sheet = page.getByRole('dialog', { name: CART_NAME });
  if (await sheet.isVisible()) return;
  await page.getByRole('button', { name: /^Xem phiếu \(/ }).click();
  await expect(sheet).toBeVisible();
}

export async function closeCart(page: Page, info: TestInfo) {
  if (!isMobile(info)) return;
  const sheet = page.getByRole('dialog', { name: CART_NAME });
  if (!(await sheet.isVisible())) return;
  await page.keyboard.press('Escape');
  await expect(sheet).toBeHidden();
}

/** Waits for the /api/files/:id response (ok) and for the <img> to decode. Start it BEFORE the navigation that triggers the load. */
export async function waitForImageLoaded(page: Page, img: Locator, fileId: string, timeoutMs = 20_000): Promise<void> {
  const response = page.waitForResponse((r) => r.url().includes(`/api/files/${fileId}`) && r.ok(), { timeout: timeoutMs });
  await response;
  await expect.poll(() => img.evaluate((e: HTMLImageElement) => e.complete && e.naturalWidth > 0), { timeout: timeoutMs }).toBe(true);
}
